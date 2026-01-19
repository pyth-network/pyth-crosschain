# LLM Documentation Verification Framework

**Date:** January 2026
**Repository:** `pyth-crosschain/apps/developer-hub`
**Related:** [LLM_ACCESSIBILITY_REPORT.md](./LLM_ACCESSIBILITY_REPORT.md)

---

## Executive Summary

This framework provides a repeatable process to validate that documentation changes improve LLM behavior. It focuses on three key outcomes:

1. **Correct retrieval** - LLMs find the right documents first
2. **Correct integration path selection** - LLMs choose the right product, chain, and patterns
3. **No hallucination** - LLMs do not generate deprecated or unsafe patterns

---

## Table of Contents

1. [Verification Strategy](#1-verification-strategy)
2. [Test Types and Evaluation Methods](#2-test-types-and-evaluation-methods)
3. [Success Metrics and Thresholds](#3-success-metrics-and-thresholds)
4. [Practical Test Prompts](#4-practical-test-prompts)
5. [Scaling and Maintenance](#5-scaling-and-maintenance)
6. [Implementation Checklist](#6-implementation-checklist)

---

## 1. Verification Strategy

### 1.1 Test Corpus Design

Create a structured test corpus with **50-100 test prompts** organized by category:

| Category | Example Prompts | Expected Behavior |
|----------|-----------------|-------------------|
| **Product Selection** | "How do I get random numbers on Arbitrum?" | Retrieves Entropy docs, not Price Feeds |
| **Chain Selection** | "Pyth integration for Solana" | Returns SVM-specific code, not EVM |
| **Pull vs Push** | "I want prices updated automatically" | Explains push feeds, links to sponsored feeds list |
| **Version Correctness** | "Pyth SDK installation" | Returns current `@pythnetwork/hermes-client`, not deprecated packages |
| **Address Accuracy** | "Pyth contract on Base" | Returns correct address, not invented address |
| **Safety Patterns** | "Read ETH price in Solidity" | Includes staleness check, not naive `getPrice()` |

### 1.2 Golden Answer Dataset

Create authoritative answers for each test prompt in YAML format:

```yaml
# test-corpus/golden-answers.yaml

- id: entropy-arbitrum
  prompt: "How do I generate a random number in my Arbitrum smart contract using Pyth?"
  expected:
    product: entropy
    chain: arbitrum
    contract_address: "0x..." # actual Entropy address on Arbitrum
    sdk: "@pythnetwork/entropy-sdk-solidity"
    must_include:
      - "requestRandomNumber"
      - "revealRandomNumber"
      - "callback pattern"
    must_not_include:
      - "price feed"
      - "Hermes"
      - "getPrice"
    code_patterns:
      - regex: "IEntropyConsumer"
      - regex: "function entropyCallback"

- id: evm-price-basic
  prompt: "How do I read BTC/USD price in Solidity?"
  expected:
    product: price-feeds
    chain: evm
    must_include:
      - "IPyth"
      - "getPrice" or "getPriceNoOlderThan"
      - "PythStructs.Price"
      - "updatePriceFeeds"
    must_not_include:
      - "deprecated"
      - "v1"
      - "pyth-client" # old package
    safety_requirements:
      - staleness_check: required
      - fee_handling: required
    addresses:
      BTC_USD_PRICE_ID: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"

- id: push-vs-pull
  prompt: "What's the difference between push and pull oracles in Pyth?"
  expected:
    must_include:
      - "pull"
      - "Hermes"
      - "update fee"
    should_explain:
      - "user initiates update"
      - "400ms update frequency"
      - "push feeds sponsored"
```

### 1.3 Retrieval Verification

Test whether LLMs (or RAG systems) retrieve the **correct documents first**.

**Method 1: Direct RAG Testing**

If you expose a `/api/chunks` endpoint, test retrieval quality:

```typescript
// scripts/test-retrieval.ts

interface RetrievalTest {
  query: string;
  expectedTopDocs: string[];  // Expected file paths
  negativeMatches: string[]; // Should NOT appear in top 5
}

const retrievalTests: RetrievalTest[] = [
  {
    query: "entropy random number solidity",
    expectedTopDocs: [
      "content/docs/entropy/generate-random-numbers/evm.mdx",
      "content/docs/entropy/entropy-contracts.mdx"
    ],
    negativeMatches: [
      "content/docs/price-feeds/"
    ]
  },
  {
    query: "pyth contract address ethereum mainnet",
    expectedTopDocs: [
      "content/docs/price-feeds/core/contract-addresses/evm.mdx"
    ],
    negativeMatches: []
  }
];

async function testRetrieval() {
  for (const test of retrievalTests) {
    const response = await fetch(
      `https://docs.pyth.network/api/chunks?q=${encodeURIComponent(test.query)}&limit=5`
    );
    const { chunks } = await response.json();

    const topSources = chunks.map(c => c.metadata.source);

    // Verify expected docs appear
    for (const expected of test.expectedTopDocs) {
      const found = topSources.some(s => s.includes(expected));
      console.log(`[${found ? 'PASS' : 'FAIL'}] "${test.query}" -> ${expected}`);
    }

    // Verify negative matches don't appear
    for (const negative of test.negativeMatches) {
      const found = topSources.some(s => s.includes(negative));
      if (found) {
        console.log(`[FAIL] "${test.query}" incorrectly returned ${negative}`);
      }
    }
  }
}
```

**Method 2: LLM-Based Retrieval Audit**

Ask LLMs to cite their sources and verify:

```typescript
async function testLLMRetrieval(llmClient: LLMClient) {
  const prompt = `
You are helping a developer integrate Pyth. Answer their question and cite
which documentation pages you're referencing.

Question: How do I use Pyth Entropy to generate random numbers in a Solidity contract?

Provide your answer, then list the documentation URLs you referenced.
`;

  const response = await llmClient.complete(prompt);
  const citedUrls = extractUrls(response);

  const expectedUrls = [
    "docs.pyth.network/entropy",
    "docs.pyth.network/entropy/generate-random-numbers"
  ];

  return evaluateCitations(citedUrls, expectedUrls);
}
```

---

## 2. Test Types and Evaluation Methods

### 2.1 Prompt-Based Simulations (Automated)

Run automated tests against multiple LLM providers:

```typescript
// scripts/llm-eval.ts

interface LLMTestResult {
  prompt: string;
  model: string;
  response: string;
  scores: {
    correctProduct: boolean;
    correctChain: boolean;
    correctAddresses: boolean;
    noDeprecatedPatterns: boolean;
    includesSafetyChecks: boolean;
    codeCompiles: boolean;
  };
  timestamp: Date;
}

const MODELS_TO_TEST = [
  { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  { provider: 'openai', model: 'gpt-4o' },
  { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },
];

async function runEvalSuite() {
  const results: LLMTestResult[] = [];

  for (const modelConfig of MODELS_TO_TEST) {
    for (const testCase of testCorpus) {
      const systemPrompt = `
You are a helpful assistant for developers integrating Pyth Network.
Use the following documentation: ${await fetchLLMsTxt()}
`;

      const response = await callLLM(modelConfig, systemPrompt, testCase.prompt);
      const scores = evaluateResponse(response, testCase.expected);

      results.push({
        prompt: testCase.prompt,
        model: `${modelConfig.provider}/${modelConfig.model}`,
        response,
        scores,
        timestamp: new Date()
      });
    }
  }

  return results;
}

function evaluateResponse(response: string, expected: ExpectedAnswer): Scores {
  return {
    correctProduct: checkProductMention(response, expected.product),
    correctChain: checkChainSpecificity(response, expected.chain),
    correctAddresses: verifyAddresses(response, expected.addresses),
    noDeprecatedPatterns: !containsDeprecated(response, DEPRECATED_PATTERNS),
    includesSafetyChecks: checkSafetyPatterns(response, expected.safety_requirements),
    codeCompiles: await tryCompileCode(extractCodeBlocks(response)),
  };
}
```

### 2.2 Golden-Answer Tests (Accuracy Scoring)

Compare LLM responses against golden answers using semantic similarity + rule-based checks:

```typescript
interface GoldenAnswerResult {
  testId: string;
  similarity: number;        // 0-1 semantic similarity
  factualAccuracy: number;   // 0-1 based on fact extraction
  codeCorrectness: number;   // 0-1 based on code analysis
  safetyScore: number;       // 0-1 based on safety patterns
  overallScore: number;      // Weighted combination
}

async function scoreAgainstGolden(
  response: string,
  golden: GoldenAnswer
): Promise<GoldenAnswerResult> {

  // 1. Semantic similarity (embeddings)
  const responseEmbedding = await getEmbedding(response);
  const goldenEmbedding = await getEmbedding(golden.canonicalAnswer);
  const similarity = cosineSimilarity(responseEmbedding, goldenEmbedding);

  // 2. Factual accuracy (extraction-based)
  const extractedFacts = extractFacts(response);
  const factualAccuracy = compareFacts(extractedFacts, golden.requiredFacts);

  // 3. Code correctness
  const codeBlocks = extractCodeBlocks(response);
  const codeCorrectness = await evaluateCode(codeBlocks, golden.codeRequirements);

  // 4. Safety patterns
  const safetyScore = checkSafetyPatterns(response, golden.safetyPatterns);

  return {
    testId: golden.id,
    similarity,
    factualAccuracy,
    codeCorrectness,
    safetyScore,
    overallScore: (similarity * 0.2) + (factualAccuracy * 0.3) +
                  (codeCorrectness * 0.3) + (safetyScore * 0.2)
  };
}
```

### 2.3 Regression Tests (Before/After)

Run the same test suite before and after documentation changes:

```typescript
// scripts/regression-test.ts

interface RegressionReport {
  baselineDate: Date;
  currentDate: Date;
  testsRun: number;
  improvements: TestDelta[];
  regressions: TestDelta[];
  unchanged: number;
  summary: {
    overallScoreDelta: number;
    significantRegressions: number;
    recommendation: 'ship' | 'review' | 'block';
  };
}

async function runRegressionTest(
  baselineResults: LLMTestResult[],
  currentResults: LLMTestResult[]
): Promise<RegressionReport> {

  const deltas: TestDelta[] = [];

  for (const baseline of baselineResults) {
    const current = currentResults.find(
      r => r.prompt === baseline.prompt && r.model === baseline.model
    );

    if (current) {
      deltas.push({
        testId: baseline.prompt,
        model: baseline.model,
        baselineScore: computeOverallScore(baseline.scores),
        currentScore: computeOverallScore(current.scores),
        delta: computeOverallScore(current.scores) - computeOverallScore(baseline.scores),
        specificChanges: diffScores(baseline.scores, current.scores)
      });
    }
  }

  const improvements = deltas.filter(d => d.delta > 0.05);
  const regressions = deltas.filter(d => d.delta < -0.05);

  return {
    baselineDate: baselineResults[0].timestamp,
    currentDate: new Date(),
    testsRun: deltas.length,
    improvements,
    regressions,
    unchanged: deltas.length - improvements.length - regressions.length,
    summary: {
      overallScoreDelta: mean(deltas.map(d => d.delta)),
      significantRegressions: regressions.filter(r => r.delta < -0.1).length,
      recommendation: computeRecommendation(deltas)
    }
  };
}

function computeRecommendation(deltas: TestDelta[]): 'ship' | 'review' | 'block' {
  const avgDelta = mean(deltas.map(d => d.delta));
  const severeRegressions = deltas.filter(d => d.delta < -0.15).length;

  if (severeRegressions > 0) return 'block';
  if (avgDelta < -0.05) return 'review';
  return 'ship';
}
```

### 2.4 Human-in-the-Loop Review

For nuanced quality assessment, create a review queue:

```yaml
# Review queue for human evaluation

review_queue:
  - id: entropy-complex-callback
    prompt: "How do I implement a commit-reveal scheme with Entropy?"
    llm_response: "..."
    auto_scores:
      correctProduct: true
      codeCompiles: true
    needs_review:
      - "Callback pattern correctness"
      - "Gas efficiency"
      - "Security considerations mentioned"
    reviewer_checklist:
      - [ ] Response uses correct Entropy v2 patterns
      - [ ] Commit-reveal flow is correctly explained
      - [ ] Security considerations are mentioned
      - [ ] Code would work in production
```

**When to use human review:**

- New product launches (first 2 weeks)
- Complex multi-step integrations
- Security-sensitive patterns
- Edge cases where auto-scoring is uncertain
- Random sampling (10% of all tests) for calibration

---

## 3. Success Metrics and Thresholds

### 3.1 Core Metrics

| Metric | Definition | Target | Blocking Threshold |
|--------|------------|--------|-------------------|
| **Product Accuracy** | LLM selects correct Pyth product | ≥95% | <90% |
| **Chain Accuracy** | Code targets correct blockchain | ≥98% | <95% |
| **Address Accuracy** | Contract addresses are correct | 100% | <100% |
| **No Hallucination Rate** | No invented/deprecated patterns | ≥98% | <95% |
| **Safety Pattern Inclusion** | Staleness checks, fee handling | ≥90% | <80% |
| **Code Compilability** | Generated code compiles | ≥85% | <75% |

### 3.2 Before/After Comparison Framework

```typescript
interface ChangeEvaluation {
  changeset: string; // Git commit or PR

  baselineMetrics: {
    overallAccuracy: number;
    productAccuracy: number;
    addressAccuracy: number;
    safetyScore: number;
    hallucinationRate: number;
  };

  postChangeMetrics: {
    overallAccuracy: number;
    productAccuracy: number;
    addressAccuracy: number;
    safetyScore: number;
    hallucinationRate: number;
  };

  verdict: {
    significantImprovement: boolean; // >5% improvement in any metric
    noRegressions: boolean;          // No metric decreased >2%
    shipReady: boolean;              // All blocking thresholds met
  };
}
```

### 3.3 Confidence Thresholds for Shipping

```
SHIP if:
  - All blocking thresholds met
  - No metric regressed >2%
  - At least one metric improved >3%
  OR
  - All metrics unchanged (within ±1%)
  - No new failure modes detected

REVIEW if:
  - Any metric regressed 2-5%
  - New edge case failures detected
  - Human review queue >20 items

BLOCK if:
  - Address accuracy <100%
  - Any metric regressed >5%
  - Hallucination rate increased
  - Safety pattern inclusion decreased >5%
```

---

## 4. Practical Test Prompts

### 4.1 Product Selection Tests

```yaml
# Test: Entropy vs Price Feeds disambiguation
- prompt: "I need verifiable randomness for my NFT mint"
  expected_product: entropy
  expected_content:
    - "Entropy"
    - "random number"
    - "requestRandomness" OR "requestRandomNumber"
  must_not_contain:
    - "price feed"
    - "getPrice"

- prompt: "I want to build a lending protocol with liquidations"
  expected_product: price-feeds
  expected_content:
    - "price feed"
    - "Pyth"
    - "liquidation"
  must_not_contain:
    - "Entropy"
    - "random"

- prompt: "How do I protect my DEX from MEV?"
  expected_product: express-relay
  expected_content:
    - "Express Relay"
    - "MEV"
    - "searcher" OR "auction"
```

### 4.2 Chain-Specific Tests

```yaml
- prompt: "Pyth integration for Solana in Rust"
  expected:
    chain: solana
    language: rust
    sdk: "pyth-sdk-solana" OR "pyth-solana-receiver-sdk"
    code_must_include:
      - "Pubkey"
      - "AccountInfo" OR "Account"
    code_must_not_include:
      - "ethers"
      - "0x"
      - "IPyth"

- prompt: "Read Pyth prices in Move on Aptos"
  expected:
    chain: aptos
    language: move
    must_include:
      - "pyth::price"
      - "pyth::state"
    must_not_include:
      - "IPyth"
      - "import"
```

### 4.3 Safety Pattern Tests

```yaml
- prompt: "Simple price reading in Solidity"
  safety_requirements:
    required:
      - pattern: "getPriceNoOlderThan|publishTime.*check|staleness"
        reason: "Must include staleness validation"
      - pattern: "getUpdateFee|msg\\.value"
        reason: "Must show fee handling"
    recommended:
      - pattern: "confidence|conf"
        reason: "Should mention confidence interval"
    forbidden:
      - pattern: "getPrice\\(priceId\\)\\s*;\\s*$"
        reason: "Naive getPrice without staleness check is unsafe"

- prompt: "Update Pyth prices on-chain"
  safety_requirements:
    required:
      - pattern: "updatePriceFeeds.*value"
        reason: "Must include fee in transaction"
    forbidden:
      - pattern: "updatePriceFeeds\\(.*\\)\\s*;(?!.*value)"
        reason: "Missing fee will cause revert"
```

### 4.4 Deprecated Pattern Detection

```yaml
deprecated_patterns:
  - pattern: "@pythnetwork/pyth-evm-js"
    replacement: "@pythnetwork/hermes-client"
    severity: warning

  - pattern: "pyth-client"
    replacement: "@pythnetwork/hermes-client"
    severity: error

  - pattern: "PythClient\\("
    replacement: "HermesClient"
    severity: error

  - pattern: "getEmaPriceUnsafe"
    replacement: "getEmaPriceNoOlderThan"
    severity: warning

  - pattern: "getPriceUnsafe"
    replacement: "getPriceNoOlderThan"
    severity: warning

  - pattern: "https://xc-mainnet.pyth.network"
    replacement: "https://hermes.pyth.network"
    severity: error
```

---

## 5. Scaling and Maintenance

### 5.1 CI/CD Integration

```yaml
# .github/workflows/llm-eval.yml

name: LLM Documentation Evaluation

on:
  push:
    paths:
      - 'content/docs/**'
      - 'src/app/llms.txt/**'
      - 'content/*.json'
  schedule:
    - cron: '0 6 * * 1'  # Weekly on Monday

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Load baseline
        run: |
          aws s3 cp s3://pyth-llm-eval/baseline-latest.json baseline.json

      - name: Run LLM evaluation
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          npm run llm-eval -- --output results.json

      - name: Compare to baseline
        run: |
          npm run llm-eval:compare -- baseline.json results.json > report.md

      - name: Check thresholds
        run: |
          npm run llm-eval:check-thresholds -- results.json

      - name: Upload results
        run: |
          aws s3 cp results.json s3://pyth-llm-eval/results-${{ github.sha }}.json

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const report = require('fs').readFileSync('report.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              body: report
            });
```

### 5.2 Test Maintenance Process

**Monthly Review (DevRel + Engineering):**

1. **Review test corpus**
   - Add prompts for new features
   - Remove obsolete tests
   - Update golden answers for API changes

2. **Calibrate thresholds**
   - Review false positive/negative rates
   - Adjust scoring weights
   - Update deprecated patterns list

3. **Analyze failure modes**
   - Identify systematic LLM errors
   - Create targeted documentation improvements
   - Add specific tests for recurring issues

4. **Update baselines**
   - Save new baseline after major doc changes
   - Document why baseline changed

### 5.3 Monitoring Dashboard

Track metrics over time:

```typescript
// Datadog/Grafana metrics to track

const metrics = {
  // Per-model accuracy over time
  'llm_eval.accuracy.overall': { tags: ['model', 'date'] },
  'llm_eval.accuracy.product': { tags: ['model', 'product'] },
  'llm_eval.accuracy.chain': { tags: ['model', 'chain'] },

  // Failure rates
  'llm_eval.failures.hallucination': { tags: ['model', 'pattern'] },
  'llm_eval.failures.deprecated': { tags: ['model', 'deprecated_pattern'] },
  'llm_eval.failures.address': { tags: ['model', 'chain'] },

  // Trends
  'llm_eval.regression.count': { tags: ['severity'] },
  'llm_eval.improvement.count': { tags: ['category'] },
};
```

---

## 6. Implementation Checklist

### Phase 1: Foundation (Week 1)

- [ ] Create `test-corpus/golden-answers.yaml` with 30 initial test cases
- [ ] Implement basic `scripts/llm-eval.ts` script
- [ ] Set up API keys for Claude and GPT-4o
- [ ] Run baseline evaluation on current docs
- [ ] Save baseline to S3/storage

### Phase 2: Automation (Week 2)

- [ ] Add CI workflow for doc changes
- [ ] Implement regression comparison
- [ ] Create PR comment template
- [ ] Set up alerting for threshold violations

### Phase 3: Expansion (Week 3-4)

- [ ] Expand test corpus to 80+ cases
- [ ] Add retrieval testing (if `/api/chunks` available)
- [ ] Implement human review queue
- [ ] Create monitoring dashboard

### Phase 4: Iteration (Ongoing)

- [ ] Monthly test corpus review
- [ ] Quarterly threshold calibration
- [ ] Continuous addition of failure-mode tests

---

## 7. Example Evaluation Report

```markdown
# LLM Documentation Evaluation Report

**Date:** 2026-01-19
**Commit:** abc123 (Add llms.txt and contract registry)
**Models Tested:** Claude Sonnet 4, GPT-4o, Claude Haiku

## Summary

| Metric | Baseline | Current | Delta |
|--------|----------|---------|-------|
| Overall Accuracy | 72% | 89% | +17% |
| Product Accuracy | 85% | 96% | +11% |
| Address Accuracy | 45% | 100% | +55% |
| Safety Patterns | 60% | 78% | +18% |
| No Hallucinations | 88% | 95% | +7% |

## Recommendation: **SHIP**

All metrics improved. No regressions detected. Address accuracy now at 100%
(critical improvement from contract registry).

## Notable Improvements

1. **Contract addresses now 100% accurate** - Previously LLMs were inventing addresses
2. **Entropy vs Price Feeds disambiguation improved** - llms.txt clarifies products
3. **Staleness check inclusion up 18%** - CONTEXT.md patterns being followed

## Remaining Issues

1. **Cosmos integration prompts** - Still returning EVM code (3/5 tests)
2. **Pyth Pro vs Core confusion** - Need clearer differentiation in llms.txt

## Test Failures (5 total)

| Test | Model | Issue |
|------|-------|-------|
| cosmos-price-read | GPT-4o | Returns Solidity instead of CosmWasm |
| pyth-pro-streaming | Claude Haiku | Confuses Pro with Core |
| sui-move-example | All | Move code has syntax errors |

## Next Steps

1. Add Cosmos-specific examples to llms.txt
2. Clarify Pro vs Core distinction
3. Review Move code examples for correctness
```

---

## Appendix A: File Structure

Recommended directory structure for the evaluation system:

```
developer-hub/
├── LLM_ACCESSIBILITY_REPORT.md    # What to build
├── LLM_VERIFICATION_FRAMEWORK.md  # How to verify (this document)
├── scripts/
│   ├── llm-eval.ts                # Main evaluation script
│   ├── test-retrieval.ts          # RAG retrieval testing
│   └── regression-test.ts         # Before/after comparison
├── test-corpus/
│   ├── golden-answers.yaml        # Test cases and expected answers
│   ├── deprecated-patterns.yaml   # Patterns to detect
│   └── safety-patterns.yaml       # Required safety checks
└── .github/workflows/
    └── llm-eval.yml               # CI/CD workflow
```

---

## Appendix B: Quick Start Commands

```bash
# Run full evaluation suite
npm run llm-eval

# Run evaluation for specific model
npm run llm-eval -- --model claude-sonnet-4

# Compare against baseline
npm run llm-eval:compare baseline.json current.json

# Check if results pass thresholds
npm run llm-eval:check-thresholds results.json

# Update baseline (after shipping changes)
npm run llm-eval:update-baseline
```
