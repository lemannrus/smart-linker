# Smart Linker

An Obsidian plugin that automatically finds and inserts semantically related notes using AI-powered embeddings. It reads pre-computed vector embeddings and uses cosine similarity to discover connections between your notes.

## Features

- 🔗 **Automatic Related Links** — Finds semantically similar notes based on content meaning, not just keywords
- 📝 **Managed Block** — Inserts related links in a dedicated block at the end of your note
- ⚡ **Fast Local Search** — Uses pre-computed embeddings for instant similarity search
- 🎯 **Deduplication** — Automatically removes duplicate suggestions (handles chunked embeddings)
- ⚙️ **Configurable** — Adjust number of links, similarity threshold, excluded folders, and display format
- 🔄 **Non-Destructive** — Only modifies the managed block, never touches your note content

## Prerequisites

This plugin requires **[Vector Search](https://github.com/ashwin271/obsidian-vector-search)** plugin to generate embeddings for your notes.

### Setting up Vector Search

1. Install [Ollama](https://ollama.ai) for your platform
2. Pull the embedding model: `ollama pull nomic-embed-text`
3. Install the Vector Search plugin in Obsidian
4. Let it build the embeddings index for your vault

Once Vector Search has processed your vault, Smart Linker can use those embeddings to find related notes.

## Installation

### From Community Plugins (Recommended)

1. Open Obsidian Settings → Community Plugins
2. Search for "Smart Linker"
3. Click Install, then Enable

### Manual Installation

1. Download the latest release from GitHub
2. Extract to your vault's `.obsidian/plugins/smart-linker/` folder
3. Enable the plugin in Obsidian settings

## Usage

### Update Related Links for Current Note

1. Open any note in your vault
2. Run command: `Smart Linker: Update related links for current note` (via `Cmd/Ctrl+P`)
3. The plugin will insert a block at the end of your note:

```markdown
<!-- auto-related:start -->
## Related
- [[Note A]]
- [[Note B]]
- [[Note C]]
<!-- auto-related:end -->
```

### Reload Embeddings Index

If you've added new notes or regenerated embeddings:

1. Run command: `Smart Linker: Reload embeddings index`
2. Wait for the "Loaded N embeddings" notification

## Configuration

Open Settings → Smart Linker to configure:

| Setting | Description | Default |
|---------|-------------|---------|
| **Embeddings JSON path** | Path to Vector Search embeddings file | `.obsidian/plugins/vector-search/data.json` |
| **Top K results** | Maximum number of related notes to show | `5` |
| **Similarity threshold** | Minimum cosine similarity (0.0-1.0) | `0.75` |
| **Excluded folders** | Folders to exclude from results | `.obsidian`, `Templates`, `Daily` |
| **Block heading** | Heading text for the related links section | `## Related` |
| **Use full path in links** | Show full path or just note name | `true` |
| **Show similarity score** | Display similarity score next to links | `false` |

### JSON Format Support

Smart Linker automatically detects the Vector Search JSON format. It also supports:

- Array of objects: `[{ "path": "...", "embedding": [...] }, ...]`
- Map format: `{ "path/to/note": [...], ... }`

For custom formats, use Manual Mapping mode in settings.

## How It Works

1. **Reads Embeddings** — Loads pre-computed vector embeddings from Vector Search plugin
2. **Normalizes Vectors** — Pre-normalizes all vectors for fast cosine similarity calculation
3. **Finds Similar Notes** — Computes similarity between current note and all others
4. **Deduplicates Results** — Keeps only the best match per file (handles chunked notes)
5. **Updates Block** — Inserts or updates the managed block with wiki-links

## Supported Embedding Sources

Currently tested with:
- [Vector Search](https://github.com/ashwin271/obsidian-vector-search) plugin (recommended)

The parser architecture is modular, so support for other embedding sources can be added.

## Performance

- Handles vaults with 10,000+ notes
- Embeddings are cached in memory after first load
- Search is O(N) but fast due to pre-normalized vectors
- Typical search time: <100ms for 5000 notes

## Troubleshooting

### "Embeddings file not found"
- Check the embeddings path in settings
- Ensure Vector Search has completed indexing

### "No embedding found for current note"
- The note might be new — run Vector Search to index it
- Check if the note is in an excluded folder

### Links are duplicated
- This was fixed in v0.1.0 — update to latest version

## License

MIT License — see [LICENSE](LICENSE) file.

## Credits

- Uses embeddings from [Vector Search](https://github.com/ashwin271/obsidian-vector-search) by [@ashwin271](https://github.com/ashwin271)
- Built for [Obsidian](https://obsidian.md)

## Support

- 🐛 [Report bugs](https://github.com/YOUR_USERNAME/smart-linker/issues)
- 💡 [Request features](https://github.com/YOUR_USERNAME/smart-linker/issues)
- ⭐ Star on GitHub if you find it useful!

