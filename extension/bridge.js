window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "pcfinder-page") return;
  const { id, type, payload } = event.data;
  const reply = (data) => window.postMessage({ source: "pcfinder-ext", id, ...data }, window.location.origin);

  if (type === "ping") {
    reply({ type: "pong" });
    return;
  }

  if (["search", "variant", "reviews", "verify"].includes(type)) {
    chrome.runtime.sendMessage({ type, ...payload }, (result) => {
      reply({
        type: "result",
        result: result ?? { ok: false, error: chrome.runtime.lastError?.message || "Pas de réponse" },
      });
    });
  }
});
