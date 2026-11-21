// Save to localStorage. Tolerant of older save formats.
const KEY = 'solmar-save-v2';
export const Save = {
  load() {
    try {
      const raw = localStorage.getItem(KEY) || localStorage.getItem('solmar-save-v1');
      if (!raw) return null;
      const d = JSON.parse(raw);
      return {
        money: typeof d.money === 'number' ? d.money : 150,
        missions: typeof d.missions === 'number' ? d.missions : 0,
        kills: d.kills || 0,
        fares: d.fares || 0,
        packages: Array.isArray(d.packages) ? d.packages : [],
        jumps: Array.isArray(d.jumps) ? d.jumps : [],
        rp: typeof d.rp === 'number' ? d.rp : 0,
      };
    } catch (e) { return null; }
  },
  save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  },
  clear() {
    try { localStorage.removeItem(KEY); localStorage.removeItem('solmar-save-v1'); } catch (e) { /* ignore */ }
  },
};
