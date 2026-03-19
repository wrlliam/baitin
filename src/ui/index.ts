/**
 * UI / Display Components Library
 *
 * Unified fluent builder + helpers for Discord.js v14 Components V2 messages.
 * All messages built here use Components V2 (automatically handled by Discord.js v14).
 *
 * Constraints:
 *  - Max 40 nested components per message
 *  - Max 4000 characters across all TextDisplay components
 *  - Cannot mix with `content`, `embeds`, `poll`, or `stickers`
 *
 * Quick start:
 *   ui()
 *     .color(config.colors.default)
 *     .title("Command Center")
 *     .text("Pick a category below.")
 *     .divider()
 *     .buttonRow([ui.btn("Daily", "tab:daily", ButtonStyle.Primary), ui.btn("Shop", "tab:shop")])
 *     .divider()
 *     .list([
 *       ui.item("Daily Command", "Get daily coins and build a streak!", ui.btn("/daily", "cmd:daily")),
 *       ui.item("Shop", "Browse items for sale.", ui.btn("/shop", "cmd:shop")),
 *     ])
 *     .build()
 */

import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  FileBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type MessageCreateOptions,
} from "discord.js";
import config from "@/config";

// ─── Re-exports ───────────────────────────────────────────────────────────────

export {
  SeparatorSpacingSize,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ThumbnailBuilder,
  FileBuilder,
};

// ─── Core types ───────────────────────────────────────────────────────────────

/** The payload shape returned by UIBuilder.build() — spread directly into ctx.reply() / ctx.editReply() */
export type UIPayload = {
  components: any[];
  flags: number;
};

export type DisplayComponent =
  | TextDisplayBuilder
  | SectionBuilder
  | MediaGalleryBuilder
  | FileBuilder
  | SeparatorBuilder
  | ContainerBuilder;

// ─── Low-level helpers ────────────────────────────────────────────────────────

/** Creates a TextDisplayBuilder with the given markdown content. */
export function text(content: string, id?: number): TextDisplayBuilder {
  const t = new TextDisplayBuilder().setContent(content);
  if (id !== undefined) t.setId(id);
  return t;
}

export interface SeparatorOptions {
  divider?: boolean;
  spacing?: SeparatorSpacingSize;
  id?: number;
}

/** Creates a separator / spacer. `divider: true` shows a visible horizontal rule. */
export function separator(opts: SeparatorOptions = {}): SeparatorBuilder {
  const s = new SeparatorBuilder();
  if (opts.divider !== undefined) s.setDivider(opts.divider);
  if (opts.spacing !== undefined) s.setSpacing(opts.spacing);
  if (opts.id !== undefined) s.setId(opts.id);
  return s;
}

export interface SectionButtonAccessory {
  type: "button";
  customId: string;
  label: string;
  style?: ButtonStyle;
  emoji?: string;
  disabled?: boolean;
}

export interface SectionThumbnailAccessory {
  type: "thumbnail";
  url: string;
  description?: string;
  spoiler?: boolean;
}

export type SectionAccessory = SectionButtonAccessory | SectionThumbnailAccessory;

export interface SectionOptions {
  /** 1–3 text lines displayed on the left */
  texts: string[];
  accessory?: SectionAccessory;
  id?: number;
}

/** Creates a SectionBuilder with 1–3 text lines and an optional button or thumbnail accessory. */
export function section(opts: SectionOptions): SectionBuilder {
  const s = new SectionBuilder() as any;

  s.addTextDisplayComponents(
    ...opts.texts.slice(0, 3).map((content: string) =>
      new TextDisplayBuilder().setContent(content),
    ),
  );

  if (opts.accessory) {
    if (opts.accessory.type === "button") {
      const acc = opts.accessory;
      const b = new ButtonBuilder()
        .setCustomId(acc.customId)
        .setLabel(acc.label)
        .setStyle(acc.style ?? ButtonStyle.Primary);
      if (acc.emoji) b.setEmoji(acc.emoji);
      if (acc.disabled) b.setDisabled(true);
      s.setButtonAccessory(b);
    } else {
      const acc = opts.accessory;
      const t = new ThumbnailBuilder().setURL(acc.url) as any;
      if (acc.description) t.setDescription(acc.description);
      if (acc.spoiler) t.setSpoiler(true);
      s.setThumbnailAccessory(t);
    }
  }

  if (opts.id !== undefined) s.setId(opts.id);
  return s as SectionBuilder;
}

/** Creates a standalone ThumbnailBuilder (use inside a section accessory). */
export function thumbnail(url: string, description?: string, spoiler = false): ThumbnailBuilder {
  const t = new ThumbnailBuilder().setURL(url) as any;
  if (description) t.setDescription(description);
  if (spoiler) t.setSpoiler(true);
  return t as ThumbnailBuilder;
}

export interface GalleryItem {
  url: string;
  description?: string;
  spoiler?: boolean;
}

/** Creates a MediaGalleryBuilder with 1–10 images. */
export function gallery(items: GalleryItem[], id?: number): MediaGalleryBuilder {
  const g = new MediaGalleryBuilder() as any;
  g.addItems(
    ...items.slice(0, 10).map((item: GalleryItem) => {
      const i = new MediaGalleryItemBuilder().setURL(item.url) as any;
      if (item.description) i.setDescription(item.description);
      if (item.spoiler) i.setSpoiler(true);
      return i;
    }),
  );
  if (id !== undefined) g.setId(id);
  return g as MediaGalleryBuilder;
}

export interface ContainerOptions {
  accentColor?: number;
  spoiler?: boolean;
  id?: number;
}

/**
 * Wraps display components in a rounded box with optional accent color.
 * @param opts - color number, ContainerOptions object, or null for no color
 * @param children - components to nest inside
 */
export function container(
  opts: ContainerOptions | number | null,
  children: (DisplayComponent | ActionRowBuilder<any>)[],
): ContainerBuilder {
  const c = new ContainerBuilder() as any;

  const options: ContainerOptions =
    typeof opts === "number" ? { accentColor: opts } : opts === null ? {} : opts;

  if (options.accentColor !== undefined) c.setAccentColor(options.accentColor);
  if (options.spoiler) c.setSpoiler(true);
  if (options.id !== undefined) c.setId(options.id);

  for (const child of children) {
    if (child instanceof TextDisplayBuilder) {
      c.addTextDisplayComponents(child);
    } else if (child instanceof SectionBuilder) {
      c.addSectionComponents(child);
    } else if (child instanceof MediaGalleryBuilder) {
      c.addMediaGalleryComponents(child);
    } else if (child instanceof FileBuilder) {
      c.addFileComponents(child);
    } else if (child instanceof SeparatorBuilder) {
      c.addSeparatorComponents(child);
    } else if (child instanceof ActionRowBuilder) {
      c.addActionRowComponents(child);
    }
  }

  return c as ContainerBuilder;
}

/** Creates a FileBuilder (must pair with an AttachmentBuilder). */
export function file(url: string, spoiler = false, id?: number): FileBuilder {
  const f = new FileBuilder().setURL(url);
  if (spoiler) f.setSpoiler(true);
  if (id !== undefined) f.setId(id);
  return f;
}

// ─── Button helpers ───────────────────────────────────────────────────────────

/** Creates a button with a customId (Primary style by default). */
function _btn(
  label: string,
  customId: string,
  style: ButtonStyle = ButtonStyle.Primary,
): ButtonBuilder {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
}

/** Creates a link button (opens a URL instead of firing an interaction). */
function _linkBtn(label: string, url: string): ButtonBuilder {
  return new ButtonBuilder().setLabel(label).setURL(url).setStyle(ButtonStyle.Link);
}

/**
 * Creates a list item. When an accessory is provided, returns a SectionBuilder with
 * text on the left and a button or thumbnail on the right. When no accessory is
 * provided, returns a TextDisplayBuilder formatted as "**name** — desc" (SectionBuilder
 * requires an accessory per Discord's Components V2 spec).
 *
 * @example
 * ui.item("Daily Command", "Get daily coins!", ui.btn("/daily", "cmd:daily"))
 * ui.item("Wallet", "500 coins") // → TextDisplayBuilder
 */
function _item(
  name: string,
  desc: string,
  accessory?: ButtonBuilder | SectionButtonAccessory | SectionThumbnailAccessory,
): SectionBuilder | TextDisplayBuilder {
  if (!accessory) {
    return new TextDisplayBuilder().setContent(`**${name}** — ${desc}`);
  }

  let resolved: SectionAccessory | undefined;

  if (accessory instanceof ButtonBuilder) {
    const data = accessory.toJSON() as any;
    resolved = {
      type: "button",
      customId: data.custom_id ?? "",
      label: data.label ?? "",
      style: data.style,
      emoji: data.emoji?.name,
      disabled: data.disabled,
    };
  } else {
    resolved = accessory;
  }

  return section({ texts: [`**${name}**`, desc], accessory: resolved });
}

// ─── UIBuilder ────────────────────────────────────────────────────────────────

/**
 * Fluent builder that composes everything into a single ContainerBuilder.
 *
 * Call `.build()` at the end to get a UIPayload ready for ctx.reply() / ctx.editReply().
 *
 * @example
 * ui()
 *   .color(config.colors.default)
 *   .title("Command Center")
 *   .text("Pick a category below.")
 *   .divider()
 *   .buttonRow([ui.btn("Daily", "tab:daily", ButtonStyle.Primary), ui.btn("Shop", "tab:shop")])
 *   .divider()
 *   .list([
 *     ui.item("Daily Command", "Get daily coins and build a streak!", ui.btn("/daily", "cmd:daily")),
 *   ])
 *   .build()
 */
export class UIBuilder {
  /** Exposed for commands that need to extract the raw ContainerBuilder. */
  readonly _container: ContainerBuilder;
  private readonly _c: any; // typed alias for (this._container as any)

  constructor() {
    this._container = new ContainerBuilder();
    this._c = this._container;
  }

  // ── Color ──────────────────────────────────────────────────────────────────

  /** Sets the container's left-border accent color. Accepts a hex string or number. */
  color(hex: string | number): this {
    const num = typeof hex === "number" ? hex : parseInt(hex.replace("#", ""), 16);
    this._c.setAccentColor(num);
    return this;
  }

  // ── Text blocks ────────────────────────────────────────────────────────────

  /** Adds a large bold title (`## text`). */
  title(content: string): this {
    this._c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${content}`));
    return this;
  }

  /** Adds a level-1 heading (`# text`) — very large. Use `.title()` for standard headings. */
  header(content: string): this {
    this._c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${content}`));
    return this;
  }

  /** Adds a plain text block. Supports markdown. */
  text(content: string): this {
    this._c.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    return this;
  }

  /** Alias for `.text()` — kept for backward compatibility. */
  body(content: string): this {
    return this.text(content);
  }

  /** Adds a block-quote (`> text`). */
  quote(content: string): this {
    this._c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`> ${content}`));
    return this;
  }

  /** Adds small subtext (`-# text`). */
  footer(content: string): this {
    this._c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${content}`));
    return this;
  }

  // ── Separators ─────────────────────────────────────────────────────────────

  /** Adds a visible horizontal rule. */
  divider(spacing = SeparatorSpacingSize.Small): this {
    this._c.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(spacing),
    );
    return this;
  }

  /** Adds an invisible spacing gap (no line). */
  gap(spacing = SeparatorSpacingSize.Small): this {
    this._c.addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(spacing),
    );
    return this;
  }

  // ── Interactive blocks ─────────────────────────────────────────────────────

  /**
   * Adds a row of buttons INSIDE the container (visible as a tab bar, action row, etc.).
   * Max 5 buttons per row.
   *
   * @example
   * .buttonRow([ui.btn("Daily", "tab:daily", ButtonStyle.Primary), ui.btn("Shop", "tab:shop")])
   */
  buttonRow(buttons: ButtonBuilder[]): this {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(0, 5));
    this._c.addActionRowComponents(row);
    return this;
  }

  /**
   * Adds a section with text on the left and an optional button or thumbnail on the right.
   *
   * @example
   * .section("**Fish:** Salmon\nWeight: 4.2 kg", ui.btn("Sell", "sell:salmon"))
   */
  section(content: string, accessory?: ButtonBuilder | ThumbnailBuilder): this {
    const sec = new SectionBuilder() as any;
    sec.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    if (accessory instanceof ThumbnailBuilder) {
      sec.setThumbnailAccessory(accessory);
    } else if (accessory instanceof ButtonBuilder) {
      sec.setButtonAccessory(accessory);
    }
    this._c.addSectionComponents(sec);
    return this;
  }

  /**
   * Adds a list of items (e.g. from `ui.item(...)`).
   * SectionBuilder items render as a row with text + accessory; TextDisplayBuilder items
   * render as plain formatted text (used when no accessory is provided).
   *
   * @example
   * .list([
   *   ui.item("Daily Command", "Get daily coins!", ui.btn("/daily", "cmd:daily")),
   *   ui.item("Wallet", "500 coins"), // no accessory → text display
   * ])
   */
  list(items: (SectionBuilder | TextDisplayBuilder)[]): this {
    for (const item of items) {
      if (item instanceof TextDisplayBuilder) {
        this._c.addTextDisplayComponents(item);
      } else {
        this._c.addSectionComponents(item);
      }
    }
    return this;
  }

  /** Adds a media gallery (1–10 images). */
  gallery(items: GalleryItem[]): this {
    this._c.addMediaGalleryComponents(gallery(items));
    return this;
  }

  /** Adds a raw display component directly. */
  add(component: DisplayComponent): this {
    if (component instanceof TextDisplayBuilder) {
      this._c.addTextDisplayComponents(component);
    } else if (component instanceof SectionBuilder) {
      this._c.addSectionComponents(component);
    } else if (component instanceof MediaGalleryBuilder) {
      this._c.addMediaGalleryComponents(component);
    } else if (component instanceof FileBuilder) {
      this._c.addFileComponents(component);
    } else if (component instanceof SeparatorBuilder) {
      this._c.addSeparatorComponents(component);
    }
    return this;
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  /**
   * Returns the final UIPayload to spread into ctx.reply() / ctx.editReply().
   * Pass `rows` to add extra ActionRows OUTSIDE the container (e.g. navigation buttons).
   *
   * @example
   * ctx.editReply({ ...ui().title("Hi").build(), ephemeral: true })
   * ctx.editReply(ui().title("Shop").build({ rows: [navRow] }) as any)
   */
  build(opts?: { rows?: ActionRowBuilder<any>[] }): UIPayload {
    return {
      flags: MessageFlags.IsComponentsV2,
      components: [this._container, ...(opts?.rows ?? [])],
    };
  }
}

// ─── ui() entry point + static helpers ───────────────────────────────────────

/**
 * Creates a new UIBuilder.
 *
 * Also exposes static helpers as properties:
 *   - `ui.btn(label, customId, style?)` — ButtonBuilder with customId
 *   - `ui.linkBtn(label, url)` — link ButtonBuilder
 *   - `ui.item(name, desc, accessory?)` — SectionBuilder list item
 *   - `ui.thumbnail(url, desc?)` — ThumbnailBuilder
 */
export function ui(): UIBuilder {
  return new UIBuilder();
}

export namespace ui {
  export const btn = _btn;
  export const linkBtn = _linkBtn;
  export const item = _item;
  export const thumb = thumbnail;
}

// Also export as standalone named functions for direct imports
export const btn = _btn;
export const linkBtn = _linkBtn;
export const item = _item;

// ─── Quick message helpers ────────────────────────────────────────────────────

function hexToInt(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

/** Returns a success-colored UIPayload with a header and body. */
export function successMsg(title: string, description: string): UIPayload {
  return ui().color(config.colors.success).title(title).text(description).build();
}

/** Returns an error-colored UIPayload with a header and body. */
export function errorMsg(title: string, description: string): UIPayload {
  return ui().color(config.colors.error).title(title).text(description).build();
}

/** Returns an info-colored UIPayload with a header and body. */
export function infoMsg(title: string, description: string): UIPayload {
  return ui().color(config.colors.info).title(title).text(description).build();
}

/** Returns a warning-colored UIPayload with a header and body. */
export function warnMsg(title: string, description: string): UIPayload {
  return ui().color(config.colors.warn).title(title).text(description).build();
}

// ─── Stand-alone layout helpers (from display.ts) ────────────────────────────

export type NoticeKind = "success" | "error" | "info" | "warning";

const NOTICE_COLORS: Record<NoticeKind, number> = {
  success: hexToInt(config.colors.success),
  error: hexToInt(config.colors.error),
  info: hexToInt(config.colors.info),
  warning: hexToInt(config.colors.warn),
};

const NOTICE_ICONS: Record<NoticeKind, string> = {
  success: config.emojis.tick,
  error: config.emojis.cross,
  info: config.emojis.help,
  warning: config.emojis.warning,
};

/** Quick single-line notice inside a colored container. */
export function notice(kind: NoticeKind, message: string): UIPayload {
  const icon = NOTICE_ICONS[kind];
  const color = NOTICE_COLORS[kind];
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [container(color, [text(`${icon} ${message}`)])],
  };
}

/** Renders a unicode progress bar string. e.g. `███░░░░░░░ 35%` */
export function progressBar(current: number, max: number, length = 12): string {
  const ratio = Math.min(current / max, 1);
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  const pct = Math.round(ratio * 100);
  return `${"█".repeat(filled)}${"░".repeat(empty)} ${pct}%`;
}

/** Returns a cooldown warning payload. */
export function cooldownMsg(remainingMs: number, action = "use this command"): UIPayload {
  const seconds = Math.ceil(remainingMs / 1000);
  const formatted =
    seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
  return notice("warning", `You're on cooldown! You can ${action} again in **${formatted}**.`);
}

export interface CardField {
  name: string;
  value: string;
}

export interface CardOptions {
  title?: string;
  description?: string;
  color?: number;
  fields?: CardField[];
  thumbnailUrl?: string;
  footerText?: string;
}

/** Embed-like card layout with optional thumbnail, fields, and footer. */
export function card(opts: CardOptions): UIPayload {
  const builder = ui();
  if (opts.color) builder.color(opts.color);
  if (opts.title) builder.title(opts.title);
  if (opts.description) builder.text(opts.description);

  if (opts.fields && opts.fields.length > 0) {
    builder.divider();
    for (const field of opts.fields) {
      if (opts.thumbnailUrl) {
        builder.section(
          `**${field.name}**\n${field.value}`,
          thumbnail(opts.thumbnailUrl),
        );
      } else {
        builder.text(`**${field.name}**\n${field.value}`);
      }
    }
  }

  if (opts.footerText) builder.footer(opts.footerText);
  return builder.build();
}

export interface ProfileStat {
  name: string;
  value: string;
}

export interface ProfileOptions {
  username: string;
  avatarUrl?: string;
  color?: number;
  level?: number;
  xp?: { current: number; max: number };
  stats?: ProfileStat[];
  badgeText?: string;
  footerText?: string;
}

/** Renders a user profile card. */
export function profileCard(opts: ProfileOptions): UIPayload {
  const builder = ui();
  if (opts.color) builder.color(opts.color);

  const headerLines: string[] = [`## ${opts.username}`];
  if (opts.badgeText) headerLines.push(`*${opts.badgeText}*`);
  if (opts.level !== undefined) headerLines.push(`Level **${opts.level}**`);

  if (opts.avatarUrl) {
    builder.section(headerLines.join("\n"), thumbnail(opts.avatarUrl));
  } else {
    builder.text(headerLines.join("\n"));
  }

  if (opts.xp) {
    builder.gap();
    builder.text(
      `**XP** ${progressBar(opts.xp.current, opts.xp.max)} \`${opts.xp.current.toLocaleString()} / ${opts.xp.max.toLocaleString()}\``,
    );
  }

  if (opts.stats && opts.stats.length > 0) {
    builder.divider();
    builder.text(opts.stats.map((s) => `**${s.name}:** ${s.value}`).join("\n"));
  }

  if (opts.footerText) {
    builder.divider();
    builder.footer(opts.footerText);
  }

  return builder.build();
}
