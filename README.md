# Hermes Action Bar

A Hermes Desktop plugin for the questions you have while you read a reply.

Select text in a chat.
A small bar appears at the selection.

- **Reply** opens a comment box at the highlight.
  The quote and your comment become a card above the composer.
  Nothing is sent until you press Enter in the composer.
- **Ask**, **Explain**, **Summarize** and **Fact-check** open an answer card next to the highlight.
  The answer does not enter the chat, and the agent does not see it.
- **Copy** copies the selected text.

## Why

Hermes replies are long.
Most questions are about one sentence.

There are two types of question, and they need different places.

| Type | Example | Where it goes |
|---|---|---|
| The agent must act on it | "We cannot stop writes for five minutes. Give another option." | **Reply**, in the chat |
| You want to understand | "What is logical replication?" | An **answer card**, out of the chat |

A question of the second type does not belong in the chat.
It makes the history longer.
The agent reads it again on each later turn.
It can interrupt an agent that is in the middle of a task.
You also lose your place in the reply.

The answer card keeps that question next to the sentence.
If the answer matters to the work, **Send to chat** moves it into the composer.

## Use

### Reply

1. Select text in a reply.
2. Click **Reply**, or press **Cmd+Option+R** (Ctrl+Alt+R on Windows and Linux).
3. Type a comment and press Enter. The comment is optional.
4. Do this again for each passage that you want to answer.
5. Type your message in the composer and press Enter.

The agent gets each quote as a Markdown blockquote, with its comment below it, and then your message.

```
> Cut over during a brief pause. Downtime is typically one to five minutes.

We cannot stop writes for five minutes. Give an option with less downtime.

> Use pg_dump or pg_basebackup to restore a full copy of the database.

Which one is better for a 20 GB database?

Keep each answer to two sentences.
```

You can edit a comment or remove a reply in the strip above the composer.
The **Send** button on the strip sends the replies when the composer is empty.
Replies belong to the chat where you made them.

### Ask and the fixed actions

1. Select text.
2. Click **Explain**, **Summarize** or **Fact-check**. Or click **Ask** and type your own question.
3. Read the answer in the card.
4. Type a follow-up question in the card if you have one.

The model gets the highlighted text, the text around it, and the earlier turns of the card.
It does not get the chat history.

**Send to chat** puts the quote and the last answer in the composer.
It does not send them.

Escape closes the card.

### Your own actions

Open **Settings > Plugins > Action Bar**.

Each action is a label and a prompt.
You can change the three defaults, add your own, and change their order.
The first three actions show on the bar.
The others are behind the arrow.

**Add research set** adds an example set for investment research: Implications, Bull case, Bear case and Find the source.

The same page sets where the bar appears: in chat messages only (the default), or on any text outside an input.

### Shortcuts

| Command | Default |
|---|---|
| Reply to selection | Cmd+Option+R |
| Ask about selection | Cmd+Option+A |
| Explain selection | Cmd+Option+E |

You can change them in the shortcuts panel.
The commands are also in the command palette.

## Install

**From Git:** in Hermes Desktop, open **Capabilities > Plugins > Install from Git** and paste the URL of this repository.

**By hand:** copy `desktop/plugin.js` to `~/.hermes/desktop-plugins/hermes-action-bar/plugin.js`.
On Windows the folder is `%USERPROFILE%\.hermes\desktop-plugins\hermes-action-bar\`.
Then run **Reload desktop plugins** from the command palette.

Action Bar needs Hermes 0.22.5 or later.

## How it works

The plugin is one file, `desktop/plugin.js`.
It has no Python half, no tools and no hooks.

- **The bar and the card** are the plugin's own elements on `<body>`. They use theme variables only.
- **The highlight** stays visible after the selection is gone. The plugin paints it with the CSS Custom Highlight API, which does not change the page.
- **Reply cards** render in the `composer.top` slot. A `composer.middleware` handler puts them in front of your message when you send.
- **Answers** come from `host.request('llm.oneshot')`. This is one stateless model call. It reads no session history and writes none.
- **Settings** are in `ctx.storage`.

The plugin does not select, restyle or rewrite app markup.
It reads one documented attribute, `data-chat-surface`, to know that a selection is in a chat.
If that attribute is not on the page, the bar shows for any selection outside an input.

Two safety details:

- **Quotes stay inert.** Hermes turns `@file:` and other `@kind:` text into live context references. A reply can contain such text, also by prompt injection. Action Bar puts a zero-width space after the `@` in each quote, so a quote can never attach a file.
- **Model output stays text.** The card renders Markdown with `createElement` and text nodes only. It never parses HTML.

## Privacy

- An answer card sends the highlighted text, the text around it (at most 4,000 characters) and the card's earlier turns to your configured model provider. It uses the model of the open chat, or your auxiliary model.
- Reply and Copy send nothing.
- Pending replies stay in memory until you send or remove them. They are not written to disk.
- Your actions and the scope setting are saved in the plugin's own storage.
- There is no telemetry and no other network call.

## Limits

- An answer arrives complete. It does not appear word by word, because `llm.oneshot` does not stream.
- The answer model has no tools and no web access. Fact-check tells you what to verify. Use **Send to chat** to let the agent verify it with its tools.
- While the agent works, a typed Enter steers the turn and does not pass through plugin middleware ([hermes-agent#126917](https://github.com/NousResearch/hermes-agent/issues/126917)). The replies stay in the strip. Use the **Send** button to deliver them.
- With several chat tiles open, the strip shows the replies of the chat that has focus.

## Develop

```sh
npm install
npm run check
npm test
```

The tests run the real `desktop/plugin.js` in jsdom with a fake SDK.

```sh
npm run harness
```

This builds a mock chat page and serves it at `http://localhost:4173`.
The page loads the real plugin file in a browser, with real layout and real selections.
The model answers on that page are canned.

```sh
hermes plugins validate .
```

This runs the catalog admission checks.

## See also

- [freefate258/quote-ask](https://github.com/freefate258/quote-ask) quotes a selection into the composer.
- [BrokeSkill/Hermes-Insight](https://github.com/BrokeSkill/Hermes-Insight) defines a selected term in a side panel.
- [fquresh/hermes-quote-selection](https://github.com/fquresh/hermes-quote-selection) is the plugin that Action Bar grew from.

Action Bar shares no code with the first two.
It differs in three ways: one comment for each quote, answers that stay out of the chat with follow-up questions, and actions that the user defines.

## License

MIT
