import { mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { questionsFor, parseResponse, validateInput } from './core.mjs';

export class JevProvider {
  constructor({ key, directory, maxRequests=160, maxInputTokens=600000, model='jev-latest' }) {
    this.key=key; this.directory=directory; this.maxRequests=maxRequests; this.maxInputTokens=maxInputTokens;
    this.model=model; this.requests=0; this.inputTokens=0; this.outputTokens=0; this.busy=false;
  }
  status() { return { available:Boolean(this.key), requests:this.requests, maxRequests:this.maxRequests, inputTokens:this.inputTokens, maxInputTokens:this.maxInputTokens, busy:this.busy }; }
  async evaluate(observation, weights, { singleOnly=false }={}) {
    if (!this.key) throw new Error('Jev is not connected. Use launch.ps1 to start with the scoped Proton key.');
    if (this.busy) throw new Error('A Jev decision is already in flight.');
    if (this.requests>=this.maxRequests || this.inputTokens>=this.maxInputTokens) throw new Error('This session reached its live request or token limit.');
    const input=validateInput(observation,weights);
    const payload=questionsFor(input.state,input.weights); payload.model=this.model;
    if(singleOnly) payload.questions={single:payload.questions.single};
    const body=JSON.stringify(payload);
    if (Buffer.byteLength(body)>50000) throw new Error('Request exceeds the experiment size limit.');
    this.busy=true; this.requests++;
    const id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
    const start=performance.now();
    const receipt={ id, timestamp:new Date().toISOString(), request:payload, requestSha256:createHash('sha256').update(body).digest('hex') };
    let failure;
    try {
      const response=await fetch('https://api.typesafe.ai/v1/systemone',{
        method:'POST', headers:{'Content-Type':'application/json',Authorization:'Bearer '+this.key},
        body, signal:AbortSignal.timeout(20000), redirect:'error'
      });
      receipt.status=response.status;
      if (!response.ok) throw new Error(`Jev returned HTTP ${response.status}. No automatic retry was made.`);
      const raw=await response.json();
      // The service receives no secret inside the state; never persist headers or errors.
      receipt.response=raw;
      const result=parseResponse(raw,{singleOnly});
      const usage=raw.usage;
      if (!Number.isInteger(usage?.input_tokens) || usage.input_tokens<0 || !Number.isInteger(usage?.output_tokens) || usage.output_tokens<0) throw new Error('Jev did not return valid token usage.');
      this.inputTokens+=usage.input_tokens; this.outputTokens+=usage.output_tokens;
      receipt.latencyMs=Math.round(performance.now()-start);
      receipt.valid=true;
      return { ...result, receiptId:id, latencyMs:receipt.latencyMs, usage, budget:this.status() };
    } catch (err) {
      receipt.latencyMs=Math.round(performance.now()-start); receipt.valid=false;
      failure=receipt.status && receipt.status!==200 ? `Jev returned HTTP ${receipt.status}. No automatic retry was made.`
        : err.name==='TimeoutError' ? 'Jev exceeded the 20 second timeout.'
        : receipt.response ? 'Jev returned a response that failed schema validation.' : 'Jev could not be reached.';
      receipt.error=failure;
      throw new Error(failure);
    } finally {
      this.busy=false;
      await mkdir(this.directory,{recursive:true});
      await writeFile(new URL(id+'.json',this.directory),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
    }
  }
}
