export default class TTLCache {
  constructor({ ttl } = {}) {
    this.ttl = typeof ttl === "number" ? ttl : 0;
    this.store = new Map();
  }
  has(key) {
    const v = this.store.get(key);
    if (!v) return false;
    const [val, exp] = v;
    if (exp !== 0 && Date.now() > exp) {
      this.store.delete(key);
      return false;
    }
    return true;
  }
  set(key, value) {
    const exp = this.ttl ? Date.now() + this.ttl : 0;
    this.store.set(key, [value, exp]);
  }
}
