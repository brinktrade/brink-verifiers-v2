const fs = require('fs')
const constants = require('./constants')

const contracts = [
  ['./artifacts/contracts/Verifiers/ApprovalSwapsV1.sol/ApprovalSwapsV1.json', constants.APPROVAL_SWAPS_V1],
]

function generateInterface () {
  let contractsJSON = {}
  for (let i in contracts) {
    const [path, address] = contracts[i]
    const { contractName, abi, bytecode, deployedBytecode } = require(path)
    contractsJSON[contractName] = { address, abi, bytecode, deployedBytecode }
  }
  console.log('Writing index.js file...')
  fs.writeFileSync('./index.js', `module.exports = ${JSON.stringify(contractsJSON, null, 2)}\n`)
  console.log('done')
  console.log()
}

generateInterface()
