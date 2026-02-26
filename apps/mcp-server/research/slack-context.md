# Slack Thread Context

## Source

**URL:** https://pythnetwork.slack.com/archives/C05LD10L5MH/p1769060030574039
**Channel:** #eng
**Date:** 2026-01-22

---

## Thread Content

### Parent Message
**From:** Tyrone van der Ley (@tyrone)
**Time:** 2026-01-22 05:33:50 UTC
**Reactions:** :raised_hands: 4, :brain: 4

> Clade Code Pyth Connector my Hackathon project

---

### Detailed Spec (Reply #1)
**From:** Tyrone van der Ley (@tyrone)
**Time:** 2026-01-22 05:35:38 UTC

#### Building an Official Claude Connector for Pyth Network

**Why Build This**

Anthropic's Claude now supports Connectors—integrations that let Claude directly access external data. By building an official Pyth connector, we enable millions of Claude users to query real-time price data in their AI conversations.

**Strategic value:**
- **Distribution** — Claude has millions of users across web, desktop, mobile, and API
- **First-mover** — The Connectors Directory is new and growing; early oracle presence establishes Pyth as the default
- **AI agents** — As agents become autonomous (Claude Code, Research mode), native oracle access positions Pyth as infrastructure for financial AI
- **Visibility** — Official connectors appear alongside Notion, Stripe, and Salesforce in Anthropic's curated directory

#### What We're Building

An MCP (Model Context Protocol) server—Anthropic's open standard for AI-to-tool connections. Our server exposes tools Claude can invoke:

| Tool | Description |
|------|-------------|
| `get_price` | Current price for an asset (e.g., ETH/USD) |
| `get_price_feed` | Price with confidence interval |
| `list_price_feeds` | All available feeds |
| `search_price_feeds` | Search feeds by name |

Backend integrates with Hermes API: https://hermes.pyth.network

#### Technical Requirements (Mandatory — Rejection if Missing)

| Requirement | Details |
|-------------|---------|
| Transport | Streamable HTTP over HTTPS with valid TLS |
| Tool Annotations | Every tool MUST have `readOnlyHint: true` or `destructiveHint: true` (1 rejection reason = 30%) |
| Firewall Allowlist | Claude IPs: https://docs.claude.com/en/api/ip-addresses |
| Status | Production-ready (not beta) |
| Documentation | 3 usage examples required |
| Privacy Policy | Published at stable HTTPS URL |
| Support Channel | Email or web form |

**Tool Annotation Example:**
```json
{
  "name": "get_price",
  "annotations": {
    "readOnlyHint": true,
    "destructiveHint": false
  }
}
```

#### Required Documentation (Minimum 3 Examples)

**Example 1:** "What's the current ETH/USD price from Pyth?"
- Returns price with timestamp and confidence interval

**Example 2:** "What crypto price feeds does Pyth offer?"
- Returns list of available feeds

**Example 3:** "Get BTC price and explain the confidence interval"
- Returns price with contextual explanation of data quality

#### Development & Testing

**SDKs:**
- TypeScript: `npm install @modelcontextprotocol/sdk`
- Python: `pip install mcp`

**Testing Required Before Submission:**
1. **Claude.ai:** Settings → Connectors → Add custom connector
2. **Claude Desktop:** Same process
3. **Claude Code:** `claude mcp add --transport http pyth https://your-server-url`

#### Submission Checklist

- [ ] All tools have safety annotations
- [ ] HTTPS with valid certs
- [ ] Claude IPs allowlisted
- [ ] 3 documented examples
- [ ] Privacy policy published
- [ ] Support channel established
- [ ] Tested on Claude.ai & Desktop

**Submit Here:** https://docs.google.com/forms/d/e/1FAIpQLSeafJF2NDI7oYx1r8o0ycivCSVLNq92Mpc1FPxMKSw1CzDkqA/viewform

#### All Reference Links

**Anthropic Docs:**
- MCP Protocol: https://modelcontextprotocol.io/
- Building Remote Servers: https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers
- Submission Guide: https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide
- Directory FAQ: https://support.claude.com/en/articles/11596036-anthropic-connectors-directory-faq
- Directory Policy: https://support.claude.com/en/articles/11697096-anthropic-mcp-directory-policy

**Development:**
- TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Python SDK: https://github.com/modelcontextprotocol/python-sdk
- Cloudflare MCP Hosting: https://developers.cloudflare.com/agents/guides/remote-mcp-server/

**Pyth:**
- API Reference: https://docs.pyth.network/price-feeds/core/api-reference
- Price Feed IDs: https://pyth.network/developers/price-feed-ids

#### Next Steps

1. Build MVP with `get_price` & `list_price_feeds`
2. Test via Claude.ai custom connector
3. Write docs, deploy to production
4. Submit form

---

### Reply #2 — Community Reference
**From:** Aditya Arora (@aditya)
**Time:** 2026-01-22 15:52:43 UTC
**Reactions:** :fireball: 1

> You can check that. We have not reviewed it yet. On the other hand, your plan looks great.
>
> **Referenced thread from Nidhi:**
> "In ETHGlobal Delhi, a team built a MCP server for Pyth, we asked them to contribute to us. Here's the repository https://github.com/itsOmSarraf/pyth-network-mcp and the docs PR https://github.com/pyth-network/documentation/pull/873"

---

## Key Takeaways

1. **Official Support** — The #eng team is receptive to this project ("your plan looks great")
2. **Community Repo Exists** — https://github.com/itsOmSarraf/pyth-network-mcp (built at ETHGlobal Delhi)
3. **Docs PR Pending** — https://github.com/pyth-network/documentation/pull/873 (not yet reviewed)
4. **Submission Requirements** — Anthropic has strict requirements for Connectors Directory listing
5. **Strategic Priority** — First-mover advantage in AI agent infrastructure

## Action Items from Thread

- [x] Analyze community repo (itsOmSarraf/pyth-network-mcp)
- [ ] Review docs PR #873 for integration patterns
- [x] Ensure all tool annotations include `readOnlyHint`/`destructiveHint` (FIXED 2026-01-26)
- [ ] Deploy to HTTPS with valid TLS
- [ ] Allowlist Claude IPs on server
- [ ] Write privacy policy
- [ ] Create support channel (email/form)
- [ ] Test on Claude.ai, Desktop, and Code
- [ ] Submit via Google Form

---

*Retrieved: 2026-01-26*
