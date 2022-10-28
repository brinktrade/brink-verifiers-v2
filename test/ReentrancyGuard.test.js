const { ethers } = require('hardhat')
const { expect } = require('chai')
const { setupProxyAccount } = require('@brinkninja/core/test/helpers')
const brinkUtils = require('@brinkninja/utils')
const { BN18 } = brinkUtils.constants
const { BN, encodeFunctionCall, splitCallData } = brinkUtils
const { signMetaTx, randomAddress } = brinkUtils.testHelpers(ethers)

const TOKEN_TO_TOKEN_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'tokenIn', type: 'address' },
  { name: 'tokenOut', type: 'address' },
  { name: 'tokenInAmount', type: 'uint256' },
  { name: 'tokenOutAmount', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' },
  { name: 'recipient', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'data', type: 'bytes' },
]

const TOKEN_TO_NFT_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'tokenIn', type: 'address' },
  { name: 'nftOut', type: 'address' },
  { name: 'tokenInAmount', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' },
  { name: 'recipient', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'data', type: 'bytes' },
]

describe('ReentrancyGuard', function() {
  beforeEach(async function () {
    const TestFulfillSwap = await ethers.getContractFactory('TestFulfillSwap')
    const CallExecutor = await ethers.getContractFactory('CallExecutor')
    const ApprovalSwapsV1 = await ethers.getContractFactory('ApprovalSwapsV1')
    const TestERC20 = await ethers.getContractFactory('TestERC20')
    const TestERC721 = await ethers.getContractFactory('TestERC721')
    const tokenA = await TestERC20.deploy('Token A', 'TKNA', 18)
    const tokenB = await TestERC20.deploy('Token B', 'TKNB', 18)
    const cryptoSkunks = await TestERC721.deploy('CryptoSkunks', 'SKUNKS')
    const { proxyAccount, proxyOwner } = await setupProxyAccount()
    await CallExecutor.deploy()
    this.testFulfillSwap = await TestFulfillSwap.deploy()
    this.approvalSwapsV1 = await ApprovalSwapsV1.deploy()
    this.proxyAccount = proxyAccount
    this.proxyOwner = proxyOwner
    this.recipient = await randomAddress()
    
    const [ defaultAccount ] = await ethers.getSigners()
    this.defaultAccount = defaultAccount
    this.tokenA = tokenA
    this.tokenB = tokenB
    this.cryptoSkunks = cryptoSkunks

    this.latestBlock = BN(await ethers.provider.getBlockNumber())
    this.expiryBlock = this.latestBlock.add(BN(1000)) // 1,000 blocks from now
    this.expiredBlock = this.latestBlock.sub(BN(1)) // 1 block ago

    this.chainId = await defaultAccount.getChainId()
  })

  describe('when reentrancy is attempted between two functions', function () {
    it('should revert', async function () {
      this.tokenASwapAmount = BN(2).mul(BN18)
      this.tokenATotalSwapAmount = BN(4).mul(BN18) // 2 TokenA input for each order
      this.tokenBSwapAmount = BN(8).mul(BN18)
      await this.tokenA.mint(this.proxyOwner.address, this.tokenATotalSwapAmount)
      await this.tokenB.mint(this.testFulfillSwap.address, this.tokenBSwapAmount)
      this.cryptoSkunkID = 123
      await this.cryptoSkunks.mint(this.testFulfillSwap.address, this.cryptoSkunkID)
      await this.tokenA.connect(this.proxyOwner).approve(this.proxyAccount.address, this.tokenATotalSwapAmount)

      // construct and sign tx1, a tokenToToken call
      const { signedData: signedData1, unsignedData: unsignedData1 } = splitCallData(encodeFunctionCall(
        'tokenToToken',
        TOKEN_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          BN(0), BN(1),
          this.tokenA.address,
          this.tokenB.address,
          this.tokenASwapAmount.toString(),
          this.tokenBSwapAmount.toString(),
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenB.address, this.tokenBSwapAmount.toString(), this.proxyOwner.address ]
          )
        ]
      ), 7)
      const signed1 = await signMetaTx({
        contract: this.proxyAccount,
        method: 'metaDelegateCall',
        signer: this.proxyOwner,
        chainId: this.chainId,
        params: [
          this.approvalSwapsV1.address,
          signedData1
        ]
      })

      // get the calldata for tx1, which we will use for the reentrancy call
      const tx1Data = await this.proxyAccount.populateTransaction.metaDelegateCall(signed1.params[0], signed1.params[1], signed1.signature, unsignedData1)

      // construct and sign tx2, which we will use for the outer call
      const { signedData: signedData2, unsignedData: unsignedData2 } = splitCallData(encodeFunctionCall(
        'tokenToNft',
        TOKEN_TO_NFT_PARAM_TYPES.map(t => t.type),
        [
          BN(0), BN(2),
          this.tokenA.address,
          this.cryptoSkunks.address,
          this.tokenASwapAmount.toString(),
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillNftOutSwapAndCall', // fulfillNftOutSwapAndCall() fills tx2, then executes tx1 (reentrancy call)
            ['address', 'uint', 'address', 'address', 'bytes'],
            [ this.cryptoSkunks.address, this.cryptoSkunkID, this.proxyOwner.address, tx1Data.to, tx1Data.data ]
          )
        ]
      ), 6)
      const signed2 = await signMetaTx({
        contract: this.proxyAccount,
        method: 'metaDelegateCall',
        signer: this.proxyOwner,
        chainId: this.chainId,
        params: [
          this.approvalSwapsV1.address,
          signedData2
        ]
      })

      // send the tx and expect reentrant call revert
      await expect(
        this.proxyAccount.metaDelegateCall(signed2.params[0], signed2.params[1], signed2.signature, unsignedData2)
      ).to.be.revertedWith('ReentrancyGuard: reentrant call')
    })
  })
})
