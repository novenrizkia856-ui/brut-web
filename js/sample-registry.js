/**
 * Sample provider registry.
 *
 * Nothing is deployed yet. Until config/contracts.js carries a market address
 * the app reads this file, so the whole journey can be walked end to end
 * without a chain. Every screen that shows one of these rows also says where
 * the row came from, so sample data is never mistaken for onchain state.
 *
 * Once the market contract exists, js/app.js reads it instead and this file
 * stays only as the offline fallback.
 */

/** @typedef {{id:string,address:string,gpu:string,total:number,free:number,rate:number,region:string,uptime:number,jobs:number,stake:number}} Provider */

/** @type {Provider[]} */
export const PROVIDERS = [
  {
    id: "4821",
    address: "0x9A3f27c1B4e0d8A7F5c26E1b0D34a9C8e7F10b25",
    gpu: "A100",
    total: 8,
    free: 8,
    rate: 1.85,
    region: "EU West",
    uptime: 99.4,
    jobs: 312,
    stake: 50,
  },
  {
    id: "6190",
    address: "0x41Dc905E7b28A6f31C0e59B7a4D28fF6031Ac7e4",
    gpu: "A100",
    total: 4,
    free: 2,
    rate: 1.62,
    region: "US East",
    uptime: 97.1,
    jobs: 88,
    stake: 25,
  },
  {
    id: "2277",
    address: "0xB70e4F9a1C38d05E62Ab7139f4E8c02D5a6719Cd",
    gpu: "A100",
    total: 2,
    free: 0,
    rate: 1.44,
    region: "SE Asia",
    uptime: 92.8,
    jobs: 19,
    stake: 0,
  },
  {
    id: "5304",
    address: "0x2E8b016dF47a935C1b0D8e2a6C4739F5bA10c8d3",
    gpu: "H100",
    total: 8,
    free: 6,
    rate: 4.20,
    region: "EU North",
    uptime: 99.8,
    jobs: 540,
    stake: 120,
  },
  {
    id: "7742",
    address: "0xC51a38E0b7D4f296A8c013B5e7F2a49D6031e8B7",
    gpu: "H100",
    total: 16,
    free: 3,
    rate: 3.95,
    region: "US West",
    uptime: 98.2,
    jobs: 196,
    stake: 80,
  },
  {
    id: "1938",
    address: "0x7fB2c40aD9e15368B0a7D24e9C3016F5a82Bd471",
    gpu: "RTX 4090",
    total: 12,
    free: 12,
    rate: 0.42,
    region: "EU Central",
    uptime: 95.6,
    jobs: 64,
    stake: 10,
  },
  {
    id: "8605",
    address: "0x38aE7c951B0d26F4a8C037E1b95D40a6f2C8137e",
    gpu: "RTX 4090",
    total: 6,
    free: 1,
    rate: 0.38,
    region: "SE Asia",
    uptime: 93.1,
    jobs: 27,
    stake: 0,
  },
];

/** The GPU models the sample registry covers, in the order the filters show. */
export const GPUS = ["A100", "H100", "RTX 4090"];
