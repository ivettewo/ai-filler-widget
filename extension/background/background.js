(() => {
  const DEFAULT_TEMPLATE =
    "Product description: {{description}}\n" +
    "Field label: {{fieldLabel}}\n" +
    "Field placeholder: {{fieldPlaceholder}}, use for context only, do not copy into the text.\n" +
    "Current value: {{fieldValue}}, If similar to a recent answer, rephrase or pick a different angle.\n" +
    "\n" +
    "Instructions:\n" +
    "- Output only the final text for the field. No explanations.\n" +
    "- Language: {{language}}.\n" +
    "- Target length: 30-100 characters.\n" +
    "- Hard limit: 200 characters.";
  const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
  const OPENAI_MODELS_ENDPOINT = "https://api.openai.com/v1/models";
  const OPENAI_MODEL = "gpt-4o-mini";
  const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
  const GROQ_MODELS_ENDPOINT = "https://api.groq.com/openai/v1/models";
  const GROQ_MODEL = "llama-3.1-8b-instant";
  const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/v1/chat/completions";
  const DEEPSEEK_MODELS_ENDPOINT = "https://api.deepseek.com/v1/models";
  const DEEPSEEK_MODEL = "deepseek-chat";
  const GEMINI_MODEL = "gemini-1.5-flash";
  const GEMINI_MODELS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
  const HARD_LIMIT_RE = /(^|\n)(-?\s*Hard limit:\s*)\d+(\s*characters\.)/i;
  const FIELD_TYPE_HINTS = {
    title: { hint: "- Field type: title. Provide a concise, descriptive title.", maxLen: 70 },
    summary: { hint: "- Field type: summary. Provide 1-2 sentences.", maxLen: 160 },
    tagline: { hint: "- Field type: tagline. Short and catchy.", maxLen: 60 },
    cta: { hint: "- Field type: CTA. 2-6 words, action-oriented.", maxLen: 40 },
    address: { hint: "- Field type: address. Provide a realistic full address.", maxLen: 120 },
    email: { hint: "- Field type: email. Provide a realistic email address.", maxLen: 64 },
    phone: { hint: "- Field type: phone. Provide a realistic phone number.", maxLen: 32 },
    url: { hint: "- Field type: url. Provide a clean URL.", maxLen: 80 },
    company: { hint: "- Field type: company name.", maxLen: 80 },
    role: { hint: "- Field type: role or job title.", maxLen: 80 },
    price: { hint: "- Field type: price. Include currency symbol.", maxLen: 24 },
    date: { hint: "- Field type: date. Use a clear format.", maxLen: 24 },
    time: { hint: "- Field type: time. Use a clear format.", maxLen: 16 },
    description: { hint: "- Field type: description. 2-4 sentences.", maxLen: 240 },
    bio: { hint: "- Field type: bio. Short paragraph.", maxLen: 320 },
    keywords: { hint: "- Field type: keywords. 5-12 items, comma-separated.", maxLen: 120 },
    tags: { hint: "- Field type: tags. 5-12 items, comma-separated.", maxLen: 120 },
    slug: { hint: "- Field type: slug. Use kebab-case.", maxLen: 80 }
  };

  function storageGet(defaults) {
    return new Promise((resolve) => {
      chrome.storage.local.get(defaults, (result) => resolve(result));
    });
  }

  function storageSet(values) {
    return new Promise((resolve) => {
      chrome.storage.local.set(values, () => resolve());
    });
  }

  async function getSettings() {
    const result = await storageGet({
      settings: {
        openaiApiKey: "",
        geminiApiKey: "",
        groqApiKey: "",
        deepseekApiKey: "",
        openaiModel: OPENAI_MODEL,
        geminiModel: GEMINI_MODEL,
        groqModel: GROQ_MODEL,
        deepseekModel: DEEPSEEK_MODEL,
        primaryProvider: "",
        language: "English",
        temperature: 0.2,
        descriptionLimitTier: "small",
        fieldPresets: [],
        promptTemplate: DEFAULT_TEMPLATE,
        encryptKey: false
      }
    });
    return result.settings || {};
  }

  function applyTemplate(
    template,
    project,
    fieldLabel,
    fieldPlaceholder,
    fieldValue,
    language
  ) {
    if (!project) return "";
    let output = template;
    if (!fieldLabel) {
      output = output.replace(/^.*\{\{\s*fieldLabel\s*\}\}.*(?:\r?\n)?/gim, "");
    }
    if (!fieldPlaceholder) {
      output = output.replace(/^.*\{\{\s*fieldPlaceholder\s*\}\}.*(?:\r?\n)?/gim, "");
    }
    if (!fieldValue) {
      output = output.replace(/^.*\{\{\s*fieldValue\s*\}\}.*(?:\r?\n)?/gim, "");
    }
    return output
      .replace(/\{\{\s*name\s*\}\}/g, project.name || "")
      .replace(/\{\{\s*description\s*\}\}/g, project.description || "")
      .replace(/\{\{\s*fieldLabel\s*\}\}/g, fieldLabel || "")
      .replace(/\{\{\s*fieldPlaceholder\s*\}\}/g, fieldPlaceholder || "")
      .replace(/\{\{\s*fieldValue\s*\}\}/g, fieldValue || "")
      .replace(/\{\{\s*language\s*\}\}/g, language || "English")
      .trim();
  }

  function normalizeLabel(label) {
    return String(label || "").trim().toLowerCase();
  }

  function collectFieldTokens(fieldMeta) {
    const values = [];
    if (!fieldMeta) return values;
    if (fieldMeta.fieldLabel) values.push(fieldMeta.fieldLabel);
    if (Array.isArray(fieldMeta.sources)) {
      fieldMeta.sources.forEach((source) => {
        if (source && source.value) values.push(source.value);
      });
    }
    if (fieldMeta.signals) {
      Object.values(fieldMeta.signals).forEach((value) => {
        if (typeof value === "string" && value.trim()) values.push(value);
      });
    }
    return values.map(normalizeLabel).filter(Boolean);
  }

  function hasKeyword(text, keywords) {
    if (!text) return false;
    return keywords.some((word) => text.includes(word));
  }

  function classifyFieldType(fieldMeta) {
    const tokens = collectFieldTokens(fieldMeta).join(" ");
    const signals = fieldMeta && fieldMeta.signals ? fieldMeta.signals : {};
    const inputType = normalizeLabel(signals.inputType);
    const autocomplete = normalizeLabel(signals.autocomplete);

    if (inputType === "email" || autocomplete.includes("email")) return "email";
    if (inputType === "tel" || autocomplete.includes("tel")) return "phone";
    if (inputType === "url" || autocomplete.includes("url")) return "url";
    if (autocomplete.includes("street") || autocomplete.includes("address")) return "address";
    if (autocomplete.includes("postal") || autocomplete.includes("zip")) return "address";

    if (hasKeyword(tokens, ["email", "e-mail"])) return "email";
    if (hasKeyword(tokens, ["phone", "tel", "mobile", "whatsapp"])) return "phone";
    if (hasKeyword(tokens, ["website", "url", "link"])) return "url";
    if (hasKeyword(tokens, ["address", "street", "city", "state", "zip", "postal", "country"])) {
      return "address";
    }
    if (hasKeyword(tokens, ["title", "headline"])) return "title";
    if (hasKeyword(tokens, ["summary", "overview"])) return "summary";
    if (hasKeyword(tokens, ["tagline", "slogan"])) return "tagline";
    if (hasKeyword(tokens, ["cta", "call to action", "button"])) return "cta";
    if (hasKeyword(tokens, ["description", "details"])) return "description";
    if (hasKeyword(tokens, ["bio", "about"])) return "bio";
    if (hasKeyword(tokens, ["keyword", "keywords"])) return "keywords";
    if (hasKeyword(tokens, ["tag", "tags"])) return "tags";
    if (hasKeyword(tokens, ["slug", "permalink"])) return "slug";
    if (hasKeyword(tokens, ["company", "organization", "organisation", "brand"])) return "company";
    if (hasKeyword(tokens, ["role", "job title", "position"])) return "role";
    if (hasKeyword(tokens, ["price", "cost", "budget"])) return "price";
    if (hasKeyword(tokens, ["date", "dob", "birthday"])) return "date";
    if (hasKeyword(tokens, ["time"])) return "time";

    return "";
  }

  function injectFieldHint(prompt, hint) {
    if (!hint) return prompt;
    const marker = "\nInstructions:\n";
    const idx = prompt.indexOf(marker);
    if (idx === -1) return `${prompt}\n${hint}`;
    return `${prompt.slice(0, idx)}\n${hint}${prompt.slice(idx)}`;
  }

  function resolveFieldTypeConfig(fieldType) {
    if (!fieldType) return null;
    return FIELD_TYPE_HINTS[fieldType] || null;
  }

  function resolveFieldLimit(settings, fieldLabel) {
    const presets = Array.isArray(settings.fieldPresets) ? settings.fieldPresets : [];
    const normalized = normalizeLabel(fieldLabel);
    if (!normalized) return null;
    const match = presets.find(
      (preset) => normalizeLabel(preset.label) === normalized
    );
    if (!match) return null;
    const maxLen = Number(match.maxLen);
    return Number.isFinite(maxLen) ? maxLen : null;
  }

  function applyHardLimit(prompt, maxLen) {
    if (!prompt || !Number.isFinite(maxLen)) return prompt;
    if (HARD_LIMIT_RE.test(prompt)) {
      return prompt.replace(
        HARD_LIMIT_RE,
        (match, lead, prefix, suffix) => `${lead}${prefix}${maxLen}${suffix}`
      );
    }
    return `${prompt}\n- Hard limit: ${maxLen} characters.`;
  }

  function maskApiKey(value) {
    if (!value) return value;
    return "***";
  }

  function sanitizeUrl(url) {
    if (!url) return url;
    return url.replace(/([?&]key=)[^&]+/i, "$1***");
  }

  function extractUsage(data, provider) {
    if (!data) return null;
    if (provider === "gemini") {
      const meta = data.usageMetadata || {};
      const prompt = Number(meta.promptTokenCount);
      const completion = Number(meta.candidatesTokenCount);
      const total = Number(meta.totalTokenCount);
      return {
        promptTokens: Number.isFinite(prompt) ? prompt : null,
        completionTokens: Number.isFinite(completion) ? completion : null,
        totalTokens: Number.isFinite(total) ? total : null
      };
    }
    const usage = data.usage || {};
    const prompt = Number(usage.prompt_tokens);
    const completion = Number(usage.completion_tokens);
    const total = Number(usage.total_tokens);
    return {
      promptTokens: Number.isFinite(prompt) ? prompt : null,
      completionTokens: Number.isFinite(completion) ? completion : null,
      totalTokens: Number.isFinite(total) ? total : null
    };
  }

  function createRequestInfo({ url, method, headers, body }) {
    return {
      url,
      method,
      headers,
      body
    };
  }

  function extractJsonResponse(text) {
    try {
      return JSON.parse(text);
    } catch (error) {
      return { rawText: text };
    }
  }

  function resolvePrimaryProvider(settings) {
    const keys = {
      openai: (settings.openaiApiKey || "").trim(),
      gemini: (settings.geminiApiKey || "").trim(),
      groq: (settings.groqApiKey || "").trim(),
      deepseek: (settings.deepseekApiKey || "").trim()
    };
    const preferred = settings.primaryProvider;
    if (preferred && keys[preferred]) {
      return preferred;
    }
    const order = ["openai", "gemini", "groq", "deepseek"];
    return order.find((provider) => keys[provider]) || "";
  }

  function resolveApiKey(settings, provider) {
    if (!provider) return "";
    const map = {
      openai: settings.openaiApiKey,
      gemini: settings.geminiApiKey,
      groq: settings.groqApiKey,
      deepseek: settings.deepseekApiKey
    };
    return typeof map[provider] === "string" ? map[provider].trim() : "";
  }

  async function updateRecentFields(fieldLabel) {
    const label = (fieldLabel || "").trim();
    if (!label) return;
    const result = await storageGet({ recentFields: [] });
    const current = Array.isArray(result.recentFields) ? result.recentFields : [];
    const normalized = label.toLowerCase();
    const filtered = current.filter(
      (item) => String(item || "").toLowerCase() !== normalized
    );
    filtered.unshift(label);
    await storageSet({ recentFields: filtered.slice(0, 10) });
  }

  async function fetchOpenAi(
    apiKey,
    prompt,
    endpoint = OPENAI_ENDPOINT,
    model = OPENAI_MODEL,
    temperature = 0.2
  ) {
    const body = {
      model,
      messages: [{ role: "user", content: prompt }],
      temperature
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned an empty response.");
    }
    return content.trim();
  }

  async function fetchOpenAiDebug(
    apiKey,
    prompt,
    endpoint = OPENAI_ENDPOINT,
    model = OPENAI_MODEL,
    temperature = 0.2
  ) {
    const body = {
      model,
      messages: [{ role: "user", content: prompt }],
      temperature
    };
    const requestInfo = createRequestInfo({
      url: endpoint,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${maskApiKey(apiKey)}`
      },
      body
    });
    requestInfo.model = model;
    requestInfo.temperature = temperature;
    requestInfo.model = model;
    requestInfo.temperature = temperature;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const detail = await response.text();
      const error = new Error(`OpenAI request failed (${response.status}): ${detail}`);
      error.request = requestInfo;
      error.response = extractJsonResponse(detail);
      throw error;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      const error = new Error("OpenAI returned an empty response.");
      error.request = requestInfo;
      error.response = data;
      throw error;
    }
    return { text: content.trim(), request: requestInfo, response: data };
  }

  async function fetchGemini(apiKey, prompt, model = GEMINI_MODEL, temperature = 0.2) {
    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature }
    };
    const response = await fetch(
      `${GEMINI_MODELS_ENDPOINT}/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Gemini request failed (${response.status}): ${detail}`);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error("Gemini returned an empty response.");
    }
    return content.trim();
  }

  async function fetchGeminiDebug(apiKey, prompt, model = GEMINI_MODEL, temperature = 0.2) {
    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature }
    };
    const url = `${GEMINI_MODELS_ENDPOINT}/${model}:generateContent?key=${apiKey}`;
    const requestInfo = createRequestInfo({
      url: sanitizeUrl(url),
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body
    });
    requestInfo.model = model;
    requestInfo.temperature = temperature;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const detail = await response.text();
      const error = new Error(`Gemini request failed (${response.status}): ${detail}`);
      error.request = requestInfo;
      error.response = extractJsonResponse(detail);
      throw error;
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      const error = new Error("Gemini returned an empty response.");
      error.request = requestInfo;
      error.response = data;
      throw error;
    }
    return { text: content.trim(), request: requestInfo, response: data };
  }

  async function validateOpenAiKey(apiKey) {
    const response = await fetch(OPENAI_MODELS_ENDPOINT, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`API key validation failed (${response.status}): ${detail}`);
    }
  }

  async function validateGroqKey(apiKey) {
    const response = await fetch(GROQ_MODELS_ENDPOINT, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`API key validation failed (${response.status}): ${detail}`);
    }
  }

  async function validateGeminiKey(apiKey) {
    const response = await fetch(`${GEMINI_MODELS_ENDPOINT}?key=${apiKey}`, {
      method: "GET"
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`API key validation failed (${response.status}): ${detail}`);
    }
  }

  async function validateDeepseekKey(apiKey) {
    const response = await fetch(DEEPSEEK_MODELS_ENDPOINT, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`API key validation failed (${response.status}): ${detail}`);
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) {
      return false;
    }

    if (message.type === "TEST_API_KEY") {
      (async () => {
        try {
          const apiKey = (message.apiKey || "").trim();
          const provider = message.provider || "openai";
          if (!apiKey) {
            sendResponse({ ok: false, error: "API key is required." });
            return;
          }
          if (provider === "gemini") {
            await validateGeminiKey(apiKey);
          } else if (provider === "groq") {
            await validateGroqKey(apiKey);
          } else if (provider === "deepseek") {
            await validateDeepseekKey(apiKey);
          } else {
            await validateOpenAiKey(apiKey);
          }
          sendResponse({ ok: true });
        } catch (error) {
          sendResponse({ ok: false, error: error.message || "API key validation failed." });
        }
      })();

      return true;
    }

    if (message.type !== "GET_FILL_TEXT") {
      return false;
    }

    (async () => {
      let prompt = "";
      try {
        const settings = await getSettings();
        const template =
          settings.promptTemplate && settings.promptTemplate.trim() === DEFAULT_TEMPLATE
            ? settings.promptTemplate
            : DEFAULT_TEMPLATE;
        const language = settings.language || "English";
        const temperature = Number(settings.temperature) || 0.2;
        const openaiModel = settings.openaiModel || OPENAI_MODEL;
        const geminiModel = settings.geminiModel || GEMINI_MODEL;
        const groqModel = settings.groqModel || GROQ_MODEL;
        const deepseekModel = settings.deepseekModel || DEEPSEEK_MODEL;
        updateRecentFields(message.fieldLabel);
        const fieldMeta = message.fieldMeta || { fieldLabel: message.fieldLabel };
        const fieldType = classifyFieldType(fieldMeta);
        const fieldConfig = resolveFieldTypeConfig(fieldType);
        const basePrompt = applyTemplate(
          template,
          message.project,
          message.fieldLabel,
          message.fieldPlaceholder,
          message.fieldValue,
          language
        );
        const promptWithHint = injectFieldHint(basePrompt, fieldConfig && fieldConfig.hint);
        const maxLen =
          resolveFieldLimit(settings, message.fieldLabel) ||
          (fieldConfig ? fieldConfig.maxLen : null);
        prompt = applyHardLimit(promptWithHint, maxLen);
        const provider = resolvePrimaryProvider(settings);
        const apiKey = resolveApiKey(settings, provider);
        if (!apiKey) {
          sendResponse({ ok: false, error: "API key is missing." });
          return;
        }
        let text = "";
        let requestPayload = null;
        let responsePayload = null;
        let usagePayload = null;
        if (provider === "gemini") {
          if (message.debug) {
            const result = await fetchGeminiDebug(apiKey, prompt, geminiModel, temperature);
            text = result.text;
            requestPayload = result.request;
            responsePayload = result.response;
            usagePayload = extractUsage(responsePayload, provider);
          } else {
            text = await fetchGemini(apiKey, prompt, geminiModel, temperature);
          }
        } else if (provider === "groq") {
          if (message.debug) {
            const result = await fetchOpenAiDebug(
              apiKey,
              prompt,
              GROQ_ENDPOINT,
              groqModel,
              temperature
            );
            text = result.text;
            requestPayload = result.request;
            responsePayload = result.response;
            usagePayload = extractUsage(responsePayload, provider);
          } else {
            text = await fetchOpenAi(apiKey, prompt, GROQ_ENDPOINT, groqModel, temperature);
          }
        } else if (provider === "deepseek") {
          if (message.debug) {
            const result = await fetchOpenAiDebug(
              apiKey,
              prompt,
              DEEPSEEK_ENDPOINT,
              deepseekModel,
              temperature
            );
            text = result.text;
            requestPayload = result.request;
            responsePayload = result.response;
            usagePayload = extractUsage(responsePayload, provider);
          } else {
            text = await fetchOpenAi(
              apiKey,
              prompt,
              DEEPSEEK_ENDPOINT,
              deepseekModel,
              temperature
            );
          }
        } else {
          if (message.debug) {
            const result = await fetchOpenAiDebug(
              apiKey,
              prompt,
              OPENAI_ENDPOINT,
              openaiModel,
              temperature
            );
            text = result.text;
            requestPayload = result.request;
            responsePayload = result.response;
            usagePayload = extractUsage(responsePayload, provider);
          } else {
            text = await fetchOpenAi(apiKey, prompt, OPENAI_ENDPOINT, openaiModel, temperature);
          }
        }
        sendResponse({
          ok: true,
          text,
          prompt: message.debug ? prompt : undefined,
          request: message.debug ? requestPayload : undefined,
          response: message.debug ? responsePayload : undefined,
          usage: message.debug ? usagePayload : undefined
        });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error.message || "OpenAI request failed.",
          prompt: message.debug ? prompt : undefined,
          request: message.debug ? error.request : undefined,
          response: message.debug ? error.response : undefined
        });
      }
    })();

    return true;
  });
})();
