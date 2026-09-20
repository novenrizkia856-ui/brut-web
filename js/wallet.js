/**
 * Wallet connection.
 *
 * The app reads and simulates; it never builds, signs or sends a transaction.
 * Connecting only tells the page which account is looking, so a later build
 * can show that account's own jobs.
 *
 * The button stays hidden unless a browser wallet is actually present, so a
 * visitor without one is never offered a control that cannot work. There is no
 * WalletConnect fallback yet: with no contract to talk to, a QR flow would
 * promise more than the app can do.
 */
import { config } from "./config.js";

const button = document.querySelector("[data-wallet-connect]");
const label = document.querySelector("[data-wallet-label]");

const provider = typeof window !== "undefined" ? window.ethereum : undefined;

const short = (address) => `${address.slice(0, 6)}…${address.slice(-4)}`;

let account = "";

function paint() {
  if (!label) return;
  label.textContent = account ? short(account) : "Connect";
  if (button) button.setAttribute("aria-live", "polite");
}

async function connect() {
  if (!provider) return;
  button.disabled = true;
  try {
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    account = Array.isArray(accounts) && accounts[0] ? accounts[0] : "";
    paint();
  } catch (error) {
    /* A rejected prompt is a normal answer, not a failure to report loudly. */
    if (error && error.code !== 4001) console.warn("BRUT: wallet connect failed", error);
  } finally {
    button.disabled = false;
  }
}

function start() {
  if (!button || !provider) return;

  button.hidden = false;
  button.addEventListener("click", connect);
  paint();

  if (provider.on) {
    provider.on("accountsChanged", (accounts) => {
      account = Array.isArray(accounts) && accounts[0] ? accounts[0] : "";
      paint();
    });
  }

  /* An already authorised wallet needs no prompt. */
  provider
    .request({ method: "eth_accounts" })
    .then((accounts) => {
      account = Array.isArray(accounts) && accounts[0] ? accounts[0] : "";
      paint();
    })
    .catch(() => {});
}

export { config };
start();
