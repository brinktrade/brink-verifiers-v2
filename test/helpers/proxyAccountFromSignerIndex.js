const { ethers } = require('hardhat')
const { setupProxyAccount } = require('@brinkninja/core/test/helpers')

async function proxyAccountFromSignerIndex (signerIndex) {
  const signers = await ethers.getSigners()
  const signer = signers[signerIndex]
  if (!signer) {
    throw new Error(`Not enough signers: Index ${signerIndex} does not exist`)
  }
  const { proxyAccount } = await setupProxyAccount(signer)
  return { proxyAccount, proxyOwner: signer }
}

module.exports = proxyAccountFromSignerIndex
