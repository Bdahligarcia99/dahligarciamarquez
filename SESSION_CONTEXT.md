# Session Context - Card Builder UI Development

> Last updated: February 3, 2026

## Recent Session Summary

### Features Added - Page Wallpaper System (Feb 3, 2026)

Added per-page wallpaper selection in the Web UI dashboard:

**Database:**
- Added `wallpaper` JSONB column to `page_layouts` table
- Structure: `{ "url": "https://...", "alt": "description" }`
- SQL functions: `get_page_wallpaper`, `set_page_wallpaper`, `remove_page_wallpaper`, `get_all_page_wallpapers`

**API (`/client/src/lib/wallpaperApi.ts`):**
- `getPageWallpaper(pageId)` - Get wallpaper for a page
- `setPageWallpaper(pageId, wallpaper)` - Set wallpaper for a page
- `removePageWallpaper(pageId)` - Remove wallpaper from a page
- `getAllPageWallpapers()` - Get all wallpapers (for dashboard)

**UI (`/client/src/features/dashboard/WebUIPage.jsx`):**
- Wallpaper picker section under each page tab
- Uses existing ImagePicker component (URL or file upload)
- Preview thumbnail with Change/Remove buttons
- localStorage fallback for offline/error resilience

**To apply:** Run `/supabase/sql/13_page_wallpapers.sql` on Supabase

---

### Features Added - Font Picker for Text Boxes

Added a font selection feature to the text formatting settings in the Properties pane (Elements > Text sub-tab):

- **New property added to text boxes**: `fontFamily` (default: `'sans'`)
- **New state**: `showMoreFonts` to control expanded font picker visibility
- **New helper function**: `getFontStack(fontFamily)` - maps font keys to CSS font-family stacks

**Main Font Options (always visible):**
- Sans (Inter) - `'sans'`
- Serif (Georgia) - `'serif'`  
- Mono (system monospace) - `'mono'`

**Expanded Font Options (via "+" button):**
- Cursive, Fantasy, Times New Roman, Arial, Courier New, Verdana, Trebuchet MS, Impact

---

## Card Builder Overview

The Card Builder (`/client/src/features/dashboard/CardBuilderPage.jsx`) is a comprehensive UI editor for creating page layouts with customizable cards.

### Tools Available

| Tool | Description |
|------|-------------|
| **Grid** | Shows/hides snap-to-grid anchor points |
| **Pencil** | Draw rectangular cards by clicking two opposite corners |
| **Eraser** | Delete cards (or text boxes in isolation mode) |
| **Move** | Drag cards/elements, includes alignment options in settings pane |
| **Resize** | Drag card/element edges to resize |
| **Inspector** | Shows dimensions, distances between cards, scroll progress indicator |
| **Conveyor** | Parallax scroll settings (ratio, speed, presets) |
| **Properties** | Enter isolation mode to edit card contents |
| **Layout Manager** | Save, load, rename, publish, delete layout slots |

### Properties/Isolation Mode

When a card is selected with the Properties tool, it enters "isolation mode":
- Card is centered and scaled in viewport
- Other cards are hidden/dimmed
- Toolbar tools adapt for text box manipulation
- Exit via "Done" button or ESC key

**Properties Pane Tabs:**
- **Elements** (with sub-tabs):
  - **Text**: Add text boxes, font picker, font size, styles (bold/italic/underline/strikethrough), alignment, lists, quotes, links
  - **Image**: Placeholder (coming soon)
  - **Media**: Placeholder (coming soon)
- **Behaviors**: Placeholder (coming soon)

### Text Box Properties

```javascript
{
  id: number,
  x: number,           // Position relative to card
  y: number,
  width: number,
  height: number,
  content: string,
  fontSize: number,    // 10-72px
  fontFamily: string,  // 'sans', 'serif', 'mono', 'cursive', 'fantasy', 'times', 'arial', 'courier', 'verdana', 'trebuchet', 'impact'
  fontWeight: string,  // 'normal' | 'bold'
  fontStyle: string,   // 'normal' | 'italic'
  textAlign: string,   // 'left' | 'center' | 'right'
  textDecoration: string, // 'none' | 'underline' | 'line-through'
  listType: string,    // 'none' | 'bullet' | 'numbered'
  isQuote: boolean,
  link: string         // URL
}
```

### Undo/Redo System

Action types tracked:
- Cards: `'create'`, `'delete'`, `'move'`, `'resize'`
- Text boxes: `'textbox_create'`, `'textbox_delete'`, `'textbox_move'`, `'textbox_resize'`, `'textbox_delete_all'`

### Layout Management

- Multiple layout slots can be saved
- Layouts stored in Supabase (`page_layouts` and `page_layout_slots` tables)
- Cards stored as JSONB (includes nested textBoxes array)
- Publishing makes a layout active for the page

---

## Key Files

| File | Purpose |
|------|---------|
| `/client/src/features/dashboard/CardBuilderPage.jsx` | Main Card Builder component (~4500 lines) |
| `/client/src/features/dashboard/WebUIPage.jsx` | Web UI dashboard with wallpaper picker |
| `/client/src/lib/layoutApi.ts` | API functions for layout CRUD operations |
| `/client/src/lib/wallpaperApi.ts` | API functions for page wallpaper CRUD |
| `/supabase/sql/11_page_layouts.sql` | Page layouts table schema |
| `/supabase/sql/12_page_layout_slots.sql` | Layout slots table schema |
| `/supabase/sql/13_page_wallpapers.sql` | Page wallpapers migration (adds wallpaper column) |

---

## Styling Notes

- **Home page "Welcome to dahligarciamarquez"** (H1): `font-serif` → Georgia
- **Home page description text** (paragraph): `font-sans` → Inter
- **Default text box font**: Sans (Inter)

---

## Pending/Future Features

- [ ] Image sub-tab in Properties pane
- [ ] Media sub-tab in Properties pane  
- [ ] Behaviors tab in Properties pane
- [ ] Additional text formatting options as needed
