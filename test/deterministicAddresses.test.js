const { ethers } = require('hardhat')
const snapshot = require('snap-shot-it')
const { expect } = require('chai')
const deploySaltedBytecode = require('@brinkninja/core/test/helpers/deploySaltedBytecode')
const {
  APPROVAL_SWAPS_V1,
  CALL_EXECUTOR_V2
} = require('../constants')

describe('ApprovalSwapsV1.sol', function () {
  it('deterministic address check', async function () {
    const ApprovalSwapsV1 = await ethers.getContractFactory('ApprovalSwapsV1')
    const address = await deploySaltedBytecode(ApprovalSwapsV1.bytecode, [], [])
    snapshot(address)
    expect(address, 'Deployed account address and APPROVAL_SWAPS_V1 constant are different').to.equal(APPROVAL_SWAPS_V1)
  })
})

describe('CallExecutorV2.sol', function () {
  it('deterministic address check', async function () {
    const CallExecutorV2 = await ethers.getContractFactory('CallExecutorV2')
    const address = await deploySaltedBytecode(CallExecutorV2.bytecode, [], [])
    snapshot(address)
    expect(address, 'Deployed account address and CALL_EXECUTOR_V2 constant are different').to.equal(CALL_EXECUTOR_V2)
  })
})
