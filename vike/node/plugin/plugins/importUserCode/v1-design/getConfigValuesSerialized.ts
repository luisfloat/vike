export { getConfigValuesSerialized }
export { assertConfigValueIsSerializable }

import { assert, assertUsage, getPropAccessNotation } from '../../../utils.js'
import type {
  ConfigEnvInternal,
  ConfigValueSource,
  DefinedAt,
  PageConfigBuildTime
} from '../../../../../shared/page-configs/PageConfig.js'
import { isJsonSerializerError, stringify } from '@brillout/json-serializer/stringify'
import pc from '@brillout/picocolors'
import { getConfigValueFilePathToShowToUser } from '../../../../../shared/page-configs/helpers.js'
import { serializeConfigValue } from '../../../../../shared/page-configs/serialize/serializeConfigValue.js'
import { getConfigValueSourcesNotOverriden } from '../../../shared/getConfigValueSourcesNotOverriden.js'

function getConfigValuesSerialized(
  pageConfig: PageConfigBuildTime,
  isEnvMatch: (configEnv: ConfigEnvInternal, configValueSource?: ConfigValueSource) => boolean
): string {
  const lines: string[] = []
  Object.entries(pageConfig.configValuesComputed).forEach(([configName, configValuesComputed]) => {
    const { value, configEnv } = configValuesComputed

    if (!isEnvMatch(configEnv)) return
    // configValeSources has higher precedence
    if (pageConfig.configValueSources[configName]) return

    const configValue = pageConfig.configValues[configName]
    assert(configValue)
    const { definedAt } = configValue
    const valueSerialized = getConfigValueSerialized(value, configName, definedAt)
    serializeConfigValue(lines, configName, { definedAt, valueSerialized })
  })
  getConfigValueSourcesNotOverriden(pageConfig).forEach((configValueSource) => {
    const { configName, configEnv } = configValueSource
    const configValue = pageConfig.configValues[configName]

    if (!configValue) return
    if (!isEnvMatch(configEnv, configValueSource)) {
      return
    }

    const { value, definedAt } = configValue
    const valueSerialized = getConfigValueSerialized(value, configName, definedAt)
    serializeConfigValue(lines, configName, { definedAt, valueSerialized })
  })
  const code = lines.join('\n')
  return code
}

function assertConfigValueIsSerializable(value: unknown, configName: string, definedAt: DefinedAt) {
  // Contains asserts
  getConfigValueSerialized(value, configName, definedAt)
}

function getConfigValueSerialized(value: unknown, configName: string, definedAt: DefinedAt): string {
  const valueName = `config${getPropAccessNotation(configName)}`
  let configValueSerialized: string
  try {
    configValueSerialized = stringify(value, { valueName, forbidReactElements: true })
  } catch (err) {
    let serializationErrMsg = ''
    if (isJsonSerializerError(err)) {
      serializationErrMsg = err.messageCore
    } else {
      // When a property getter throws an error
      console.error('Serialization error:')
      console.error(err)
      serializationErrMsg = 'see serialization error printed above'
    }
    const configValueFilePathToShowToUser = getConfigValueFilePathToShowToUser({ definedAt })
    assert(configValueFilePathToShowToUser)
    assertUsage(
      false,
      [
        `The value of the config ${pc.cyan(
          configName
        )} cannot be defined inside the file ${configValueFilePathToShowToUser}:`,
        `its value must be defined in an another file and then imported by ${configValueFilePathToShowToUser}. (Because its value isn't serializable: ${serializationErrMsg}.)`,
        `Only serializable config values can be defined inside +config.h.js files, see https://vike.dev/header-file.`
      ].join(' ')
    )
  }
  configValueSerialized = JSON.stringify(configValueSerialized)
  return configValueSerialized
}