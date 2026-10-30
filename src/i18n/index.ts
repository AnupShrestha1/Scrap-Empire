import type { ItemId } from '../data/items';
import type { UpgradeId } from '../data/upgrades';
import { en } from './en';

export type StringKey = keyof typeof en;
export type StringParams = Readonly<Record<string, string | number>>;

/** Looks up a UI string and fills its `{name}` placeholders. */
export function t(key: StringKey, params?: StringParams): string {
  return format(en[key], params);
}

/** Display name of an upgrade. */
export function upgradeName(id: UpgradeId): string {
  return t(`upgradeName.${id}` as StringKey);
}

/** Display name of an item. */
export function itemName(item: ItemId): string {
  return t(`item.${item}` as StringKey);
}

/** Replaces `{name}` with `params.name`; unknown placeholders are left as they are. */
export function format(template: string, params?: StringParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
