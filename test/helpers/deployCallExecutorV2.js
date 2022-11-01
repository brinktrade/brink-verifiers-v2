const { deploySaltedContract } = require('@brinkninja/core/test/helpers')

async function deployCallExecutorV2 () {
  const callExecutor = await deploySaltedContract('CallExecutorV2', [], [])
  return callExecutor
}

module.exports = deployCallExecutorV2
