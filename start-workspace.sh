#!/bin/bash
# ===============================
# Workspace quick launcher for macOS
# - Opens dashboards in browser
# - Launches ChatGPT desktop app
# - Launches Cursor editor
# ===============================

echo ""
echo "================================"
echo "  Workspace quick launcher"
echo "================================"
echo ""

# --- Open dashboards in your default browser ---
echo "Opening dashboards..."
open "https://vercel.com/bdahligarcia99s-projects"
open "https://dashboard.render.com/"
open "https://supabase.com/dashboard/organizations"

# ============================================================
# ChatGPT Desktop
# - Tries override var CHATGPT_APP if you set it
# - Searches common install paths
# - Falls back to PATH
# ============================================================
if [ ! -z "$CHATGPT_APP" ]; then
    if [ -f "$CHATGPT_APP" ]; then
        echo "Launching ChatGPT: $CHATGPT_APP"
        open "$CHATGPT_APP"
    fi
else
    # Common ChatGPT app locations on macOS
    CHATGPT_PATHS=(
        "/Applications/ChatGPT.app"
        "/Applications/OpenAI/ChatGPT.app"
        "/usr/local/bin/chatgpt"
        "/opt/homebrew/bin/chatgpt"
    )
    
    CHATGPT_FOUND=false
    for path in "${CHATGPT_PATHS[@]}"; do
        if [ -f "$path" ] || [ -d "$path" ]; then
            echo "Launching ChatGPT: $path"
            open "$path"
            CHATGPT_FOUND=true
            break
        fi
    done
    
    if [ "$CHATGPT_FOUND" = false ]; then
        # Try to find in PATH
        if command -v chatgpt >/dev/null 2>&1; then
            echo "Launching ChatGPT from PATH"
            chatgpt &
        else
            echo "[WARN] ChatGPT desktop app not found. Set CHATGPT_APP to the full path or install the app."
        fi
    fi
fi

# --- Launch Cursor editor ---
if [ ! -z "$CURSOR_APP" ]; then
    if [ -f "$CURSOR_APP" ]; then
        echo "Launching Cursor: $CURSOR_APP"
        open "$CURSOR_APP"
    fi
else
    # Common Cursor app locations on macOS
    CURSOR_PATHS=(
        "/Applications/Cursor.app"
        "/usr/local/bin/cursor"
        "/opt/homebrew/bin/cursor"
    )
    
    CURSOR_FOUND=false
    for path in "${CURSOR_PATHS[@]}"; do
        if [ -f "$path" ] || [ -d "$path" ]; then
            echo "Launching Cursor: $path"
            open "$path"
            CURSOR_FOUND=true
            break
        fi
    done
    
    if [ "$CURSOR_FOUND" = false ]; then
        # Try to find in PATH
        if command -v cursor >/dev/null 2>&1; then
            echo "Launching Cursor from PATH"
            cursor &
        else
            echo "[WARN] Cursor not found in common locations."
            echo "If installed, add it to PATH or set CURSOR_APP to its full path."
        fi
    fi
fi

echo ""
echo "All set. Have a great session!"
