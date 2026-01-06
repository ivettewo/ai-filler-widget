# AI Filler Widget

AI Filler Widget is a browser extension that helps you fill common web form fields with concise, context-aware text using your preferred AI provider.

## Features
- One-click AI form filling for common field types
- Project system for contextual filling
- Configurable token and context limits
- Multi-provider support (OpenAI-compatible, Gemini, Groq, Deepseek)
- Local API key storage in extension settings
- Token usage hints and basic usage insights
- Lightweight popup UI with settings and docs screens

## Install (Developer Mode)
1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension/` folder.
4. Pin the extension and open it to configure your API keys.

## Configure Providers
- Open the extension popup.
- Add API keys for the providers you plan to use.
- Choose the provider in settings.



## Privacy
- The extension sends only the minimal field context required to generate text.
- API keys are stored locally in the browser extension storage.
- No keys or generated content are stored on a server by this project.

## Project Structure
- `extension/` - Chrome/Edge extension source
- `components/` - Shared UI pieces
- `docs/` - Release notes and documentation

## Build / Packaging
This repo ships the extension source. Package it using your browser's extension tooling or any standard Chrome extension packaging flow.

## License
All rights reserved. You may use this software for personal or internal purposes only. You may not redistribute, publish, or sublicense any part of this project without explicit written permission from the author.