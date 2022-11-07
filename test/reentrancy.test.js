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

describe('reentrancy checks', function() {

  // waffle's "revertedWith" doesn't do exact matching, so the message 'ReentrancyGuard' is
  // matched with 'ProxyReentrancyGuard'. This function gives us exact matching for revert errors
  const expectExactRevert = async (fn, msg) => {
    try {
      await fn
    } catch (err) {
      const msgStr = `'${msg}'`
      expect(err.message.includes(msgStr), `Error message "${err.message}" does not include "${msgStr}"`).to.be.true
      return
    }
    throw new Error(`Transaction did not revert. Expected revert with "${msgStr}"`)
  }

  beforeEach(async function () {
    const TestFulfillSwap = await ethers.getContractFactory('TestFulfillSwap')
    const ApprovalSwapsV1 = await ethers.getContractFactory('ApprovalSwapsV1')
    const TestERC20 = await ethers.getContractFactory('TestERC20')
    const TestERC721 = await ethers.getContractFactory('TestERC721')
    const tokenA = await TestERC20.deploy('Token A', 'TKNA', 18)
    const tokenB = await TestERC20.deploy('Token B', 'TKNB', 18)
    const cryptoSkunks = await TestERC721.deploy('CryptoSkunks', 'SKUNKS')
    const { proxyAccount: proxyAccount1, proxyOwner: proxyOwner1 } = await setupProxyAccount()
    const { proxyAccount: proxyAccount2, proxyOwner: proxyOwner2 } = await setupProxyAccount()
    this.testFulfillSwap = await TestFulfillSwap.deploy()
    this.approvalSwapsV1 = await ApprovalSwapsV1.deploy()
    this.proxyAccount1 = proxyAccount1
    this.proxyOwner1 = proxyOwner1
    this.proxyAccount2 = proxyAccount2
    this.proxyOwner2 = proxyOwner2
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

  describe('when reentrancy is attempted between two functions within the same account', function () {
    it('should revert in ProxyReentrancyGuard', async function () {
      this.tokenASwapAmount = BN(2).mul(BN18)
      this.tokenATotalSwapAmount = BN(4).mul(BN18) // 2 TokenA input for each order
      this.tokenBSwapAmount = BN(8).mul(BN18)
      await this.tokenA.mint(this.proxyOwner1.address, this.tokenATotalSwapAmount)
      await this.tokenB.mint(this.testFulfillSwap.address, this.tokenBSwapAmount)
      this.cryptoSkunkID = 123
      await this.cryptoSkunks.mint(this.testFulfillSwap.address, this.cryptoSkunkID)
      await this.tokenA.connect(this.proxyOwner1).approve(this.proxyAccount1.address, this.tokenATotalSwapAmount)

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
            [ this.tokenB.address, this.tokenBSwapAmount.toString(), this.proxyOwner1.address ]
          )
        ]
      ), 7)
      const signed1 = await signMetaTx({
        contract: this.proxyAccount1,
        method: 'metaDelegateCall',
        signer: this.proxyOwner1,
        chainId: this.chainId,
        params: [
          this.approvalSwapsV1.address,
          signedData1
        ]
      })

      // get the calldata for tx1, which we will use for the reentrancy call
      const tx1Data = await this.proxyAccount1.populateTransaction.metaDelegateCall(signed1.params[0], signed1.params[1], signed1.signature, unsignedData1)

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
            [ this.cryptoSkunks.address, this.cryptoSkunkID, this.proxyOwner1.address, tx1Data.to, tx1Data.data ]
          )
        ]
      ), 6)
      const signed2 = await signMetaTx({
        contract: this.proxyAccount1,
        method: 'metaDelegateCall',
        signer: this.proxyOwner1,
        chainId: this.chainId,
        params: [
          this.approvalSwapsV1.address,
          signedData2
        ]
      })

      await expectExactRevert(
        this.proxyAccount1.metaDelegateCall(signed2.params[0], signed2.params[1], signed2.signature, unsignedData2),
        'ProxyReentrancyGuard: reentrant call'
      )
    })
  })

  describe('when reentrancy is attempted between two functions in different accounts', function () {
    it('should revert in CallExecutor ReentrancyGuard', async function () {
      this.tokenASwapAmount = BN(2).mul(BN18)
      this.tokenBSwapAmount = BN(4).mul(BN18)
      this.tokenBTotalSwapAmount = BN(8).mul(BN18) // 2x tokenBSwapAmount, to fill both orders
      await this.tokenA.mint(this.proxyOwner1.address, this.tokenASwapAmount)
      await this.tokenA.mint(this.proxyOwner2.address, this.tokenASwapAmount)
      await this.tokenB.mint(this.testFulfillSwap.address, this.tokenBTotalSwapAmount)
      await this.tokenA.connect(this.proxyOwner1).approve(this.proxyAccount1.address, this.tokenASwapAmount)
      await this.tokenA.connect(this.proxyOwner2).approve(this.proxyAccount2.address, this.tokenASwapAmount)

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
            [ this.tokenB.address, this.tokenBSwapAmount.toString(), this.proxyOwner1.address ]
          )
        ]
      ), 7)
      const signed1 = await signMetaTx({
        contract: this.proxyAccount1,
        method: 'metaDelegateCall',
        signer: this.proxyOwner1,
        chainId: this.chainId,
        params: [
          this.approvalSwapsV1.address,
          signedData1
        ]
      })

      // get the calldata for tx1, which we will use for the reentrancy call
      const tx1Data = await this.proxyAccount1.populateTransaction.metaDelegateCall(signed1.params[0], signed1.params[1], signed1.signature, unsignedData1)

      // construct and sign tx2, which we will use for the outer call
      const { signedData: signedData2, unsignedData: unsignedData2 } = splitCallData(encodeFunctionCall(
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
            'fulfillTokenOutSwapAndCall', // fulfillTokenOutSwapAndCall() fills tx2, then executes tx1 (reentrancy call)
            ['address', 'uint', 'address', 'address', 'bytes'],
            [ this.tokenB.address, this.tokenBSwapAmount, this.proxyOwner2.address, tx1Data.to, tx1Data.data ]
          )
        ]
      ), 7)
      const signed2 = await signMetaTx({
        contract: this.proxyAccount2,
        method: 'metaDelegateCall',
        signer: this.proxyOwner2,
        chainId: this.chainId,
        params: [
          this.approvalSwapsV1.address,
          signedData2
        ]
      })

      await expectExactRevert(
        this.proxyAccount2.metaDelegateCall(signed2.params[0], signed2.params[1], signed2.signature, unsignedData2),
        'ReentrancyGuard: reentrant call'
      )
    })
  })
})
