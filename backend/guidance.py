"""Curated reference retrieval; never manufactures equipment procedures."""
import hashlib
import json
from pathlib import Path

CORPUS = Path(__file__).resolve().parents[1]/'knowledge/excerpts.json'
FALLBACK = 'No supported equipment-specific inspection guidance available. Technician assessment required.'


def retrieve(explanation, scope='benchmark_reference', profile_id='ai4i-demo-v1', corpus_path=CORPUS):
    result = dict(status='insufficient_evidence', mode='deterministic_curated', summary=FALLBACK,
        evidence_ids=[], sources=[], inspection_guidance=[], equipment_match=False,
        limitations='Source existence does not prove a physical cause. Manufacturer references are not validated manuals for this profile.')
    if profile_id != 'ai4i-demo-v1' or scope != 'benchmark_reference' or explanation.get('status') != 'available':
        return result
    try:
        raw = Path(corpus_path).read_bytes()
        corpus = json.loads(raw)
        ids = [item['id'] for item in corpus]
        if len(ids) != len(set(ids)):
            return result
        for item in corpus:
            if not all(item.get(k) for k in ('id','source_title','url','section','excerpt','applicability','features','guidance')):
                return result
        terms = {f['feature'] for f in explanation.get('top_factors', []) if f['contribution']>0}
        ranked = sorted(corpus, key=lambda item: (-len(terms.intersection(item['features'])), item['id']))
        sources = [item for item in ranked if terms.intersection(item['features'])][:3]
        if not sources:
            return result
        result.update(status='reference_only', summary='Benchmark context and educational references. '+FALLBACK,
            sources=sources, evidence_ids=[s['id'] for s in sources],
            inspection_guidance=[dict(text=s['guidance'], evidence_id=s['id']) for s in sources],
            corpus_sha256=hashlib.sha256(raw).hexdigest())
        return result
    except (OSError, ValueError, KeyError, TypeError):
        return result
