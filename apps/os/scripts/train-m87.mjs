/**
 * CLI helper — documents browser training.
 * M87 training runs in the OS (localStorage + RAG). Open M87 → Train M87.
 *
 * Optional: set NEXT_PUBLIC_GEMINI_API_KEY for cloud generation with RAG.
 *
 * Export training JSON from DevTools:
 *   JSON.parse(localStorage.getItem('medcore_m87_training_examples_v1'))
 */
console.log(`
M87 Super Training
──────────────────
1. Open MedCore OS → M87 AI
2. Click "Train M87" — harvests OPD/lab/beds/staff + domain seeds
3. Chat, then 👍 Teach on good answers (saved to training set)
4. Set NEXT_PUBLIC_GEMINI_API_KEY so Gemini uses RAG context

Local ML: bag-of-words scorer + retrieval (m87Train.ts)
Cloud ML: Gemini 2.0 Flash + learned examples in system prompt
`);
