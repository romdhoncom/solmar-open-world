// Street rank ladder: Street Rat to King of Solmar.
import { CFG } from './config.js';
import { CAR_MODELS, createCar } from './vehicles.js';

export function createRank(G) {
  return {
    rp: G.saveData ? G.saveData.rp : 0,
    level() {
      let l = 0;
      CFG.ranks.forEach((r, i) => { if (this.rp >= r.rp) l = i; });
      return l;
    },
    title() {
      return CFG.ranks[this.level()].title;
    },
    progress() {
      const l = this.level();
      if (l >= CFG.ranks.length - 1) return 1;
      const cur = CFG.ranks[l].rp;
      const next = CFG.ranks[l + 1].rp;
      return Math.max(0, Math.min(1, (this.rp - cur) / (next - cur)));
    },
    nextTitle() {
      const l = this.level();
      return l >= CFG.ranks.length - 1 ? '' : CFG.ranks[l + 1].title;
    },
    addRP(n) {
      const before = this.level();
      this.rp += n;
      const after = this.level();
      if (after > before) {
        G.audio.fanfare();
        G.hud.showBanner('RANK UP', 'You are now ' + CFG.ranks[after].title);
        if (CFG.ranks[after].title === 'Made' && !G.goldSunset) {
          const model = CAR_MODELS.find((m) => m.name === 'Sunset');
          const s = G.world.spots.marina;
          const car = createCar(model, s[0] - 4, s[1] + 8, Math.PI / 2);
          G.scene.add(car.mesh);
          G.cars.push(car);
          G.goldSunset = car;
          G.hud.showBanner('GOLD SUNSET UNLOCKED', 'Your reward car waits by the marina');
        }
      }
      G.hud.update();
    },
  };
}
