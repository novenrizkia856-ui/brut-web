/**
 * Job pricing and the rules that decide whether a job can be funded.
 *
 * Pure, so the same code answers the form on screen and the tests in test/.
 * Nothing here touches the DOM, the config or the chain.
 */

/** @typedef {{id:string,gpu:string,free:number,rate:number}} Provider */
/** @typedef {{gpu:string,count:number,hours:number,image:string,budget:number}} Request */

/**
 * What the job costs. A request with no provider still has GPU hours, so the
 * form can show them before anyone is picked.
 *
 * @param {Request} request
 * @param {Provider|null} provider
 */
export function price(request, provider) {
  const count = Math.max(1, Math.floor(Number(request.count) || 1));
  const hours = Math.max(1, Math.floor(Number(request.hours) || 1));
  const gpuHours = count * hours;
  const rate = provider ? Number(provider.rate) || 0 : 0;
  return { count, hours, gpuHours, rate, total: round2(gpuHours * rate) };
}

/**
 * Why this job cannot be funded, or "" when it can.
 *
 * The order matters: it is the order a person fills the form in, so the
 * message always points at the next thing to fix rather than the last.
 *
 * @param {Request} request
 * @param {Provider|null} provider
 */
export function blocker(request, provider) {
  if (!provider) return "Select a provider before funding.";

  const { count, total } = price(request, provider);

  if (provider.gpu !== request.gpu) {
    return `Provider ${provider.id} does not offer that GPU.`;
  }
  if (count > provider.free) {
    return `Provider ${provider.id} has ${provider.free} free.`;
  }
  if (!String(request.image || "").trim()) {
    return "Add a container image or script reference.";
  }
  if (total > Number(request.budget)) {
    return `The job costs $${total.toFixed(2)}, over your limit.`;
  }
  return "";
}

/** Money is compared and displayed at two decimals, so round before both. */
function round2(n) {
  return Math.round(n * 100) / 100;
}
