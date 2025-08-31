#!/usr/bin/env node
// Dummy Posts Ingestion Script
// Converts existing dummy posts to real Supabase database entries

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Find admin user
async function getAdminUserId() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .single()
  
  if (error || !data) {
    throw new Error('Admin user not found. Please create an admin user first.')
  }
  
  return data.id
}

// Get or create labels
async function ensureLabels(labelNames) {
  const labelMap = new Map()
  
  for (const name of labelNames) {
    // Check if label exists
    let { data: existing } = await supabase
      .from('labels')
      .select('id, name')
      .eq('name', name)
      .single()
    
    if (!existing) {
      // Create new label
      const { data: newLabel, error } = await supabase
        .from('labels')
        .insert({ name })
        .select('id, name')
        .single()
      
      if (error) {
        console.warn(`⚠️  Failed to create label "${name}":`, error.message)
        continue
      }
      
      existing = newLabel
    }
    
    labelMap.set(name, existing.id)
  }
  
  return labelMap
}

// Convert dummy post to rich content format
function convertToRichContent(content) {
  // Simple conversion from markdown-like content to TipTap JSON
  const lines = content.split('\n').filter(line => line.trim())
  const nodes = []
  
  for (const line of lines) {
    if (line.startsWith('# ')) {
      nodes.push({
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: line.slice(2) }]
      })
    } else if (line.startsWith('## ')) {
      nodes.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: line.slice(3) }]
      })
    } else if (line.trim()) {
      nodes.push({
        type: 'paragraph',
        content: [{ type: 'text', text: line }]
      })
    }
  }
  
  return {
    type: 'doc',
    content: nodes
  }
}

// Load dummy posts from TypeScript file
function loadDummyPosts() {
  const postsFilePath = join(projectRoot, 'client/src/data/posts.ts')
  
  if (existsSync(postsFilePath)) {
    console.log('📖 Loading dummy posts from client/src/data/posts.ts')
    const content = readFileSync(postsFilePath, 'utf8')
    
    // Extract posts array using regex (simple parsing)
    const postsMatch = content.match(/export const posts: Post\[\] = (\[[\s\S]*?\n\])/m)
    if (postsMatch) {
      try {
        // Convert TypeScript to JSON (very basic conversion)
        const postsString = postsMatch[1]
          .replace(/'/g, '"')
          .replace(/(\w+):/g, '"$1":')
          .replace(/,\s*}/g, '}')
          .replace(/,\s*\]/g, ']')
        
        return JSON.parse(postsString)
      } catch (error) {
        console.warn('⚠️  Failed to parse posts.ts, using fallback data')
      }
    }
  }
  
  // Fallback sample posts
  return [
    {
      id: 'p1',
      title: 'Finding Voice in the Noise',
      slug: 'finding-voice-in-the-noise',
      excerpt: 'On writing through distraction and learning to listen inward.',
      content: `# Finding Voice in the Noise

In our hyperconnected world, finding your authentic voice as a writer can feel like searching for silence in a symphony. Every day, we're bombarded with opinions, trending topics, and the pressure to have something profound to say about everything.

But perhaps the secret isn't in adding to the noise—it's in learning to listen inward.

## The Art of Internal Listening

True writing begins not with what we think we should say, but with what we discover we need to say. This requires a different kind of listening—one that turns away from the external chatter and toward the quiet voice within.

When I sit down to write, I often start by asking: What wants to be written today? Not what should be written, or what might get the most engagement, but what story, idea, or feeling is pressing against my consciousness, asking for attention.

## Practical Steps for Finding Your Voice

1. **Create quiet spaces**: Literally and figuratively. Find times and places where external voices fade.

2. **Write before consuming**: Before reading news, social media, or even other writers, spend time with your own thoughts.

3. **Follow your obsessions**: What keeps coming up in your mind? What questions won't leave you alone?

4. **Embrace the uncomfortable**: Often our most authentic voice emerges when we write about things that make us slightly nervous to share.

The goal isn't to be original for originality's sake, but to be honest. In a world full of noise, honesty itself becomes a form of rebellion.`,
      coverImageUrl: 'https://picsum.photos/seed/voice/1200/630',
      tags: ['personal', 'insight'],
      publishedAt: '2024-08-01T10:00:00Z'
    },
    {
      id: 'p2',
      title: 'Desert Storms, Quiet Houses',
      slug: 'desert-storms-quiet-houses',
      excerpt: 'Sand, memory, and why some homes keep secrets.',
      content: `# Desert Storms, Quiet Houses

The house stood at the edge of town, where pavement gave way to sand and the horizon stretched endless under a dome of relentless blue. My grandmother's house, with its thick adobe walls and small, deep-set windows that squinted against the desert sun.

I spent summers there as a child, and even then I knew it was a house that kept secrets.

## The Weight of Silence

Desert houses are different from other houses. They're built for endurance, not comfort. The walls are thick enough to muffle sound—and thick enough to hold it in. In that house, silence had weight. It pressed down on you during the long, hot afternoons when even the lizards sought shade.

But it was the storms that revealed the house's true nature.

When the monsoons came, they came with violence. The sky would darken to the color of old bruises, and the wind would pick up sand and fling it against the windows like rice at a wedding. Inside, we'd light candles and wait.

It was during these storms that my grandmother would tell stories. Not the sanitized family histories she'd share over Sunday dinner, but the real stories. The ones about her mother crossing the border with nothing but the clothes on her back. About the baby who didn't survive the first winter. About the man who wasn't my grandfather but who taught her to read.

## What Houses Remember

I think houses remember everything. Every conversation, every silence, every moment of joy or sorrow that happens within their walls becomes part of their foundation. My grandmother's house had absorbed decades of women's stories—stories of survival, of small rebellions, of love that had to be hidden and dreams that had to be deferred.

The desert strips things down to their essence. In that landscape, pretense doesn't survive. Neither do houses that aren't built to last, or stories that aren't true.

When my grandmother died, we sold the house to a young family with children. I hope they'll add their own stories to its walls. I hope the house will keep their secrets too, and that someday, during a storm, those children will hear echoes of all the voices that came before.

Some houses are just shelter. Others are keepers of memory. The difference isn't in their construction—it's in their willingness to listen.`,
      coverImageUrl: 'https://picsum.photos/seed/desert/1200/630',
      tags: ['personal', 'stories'],
      publishedAt: '2024-08-05T09:00:00Z'
    },
    {
      id: 'p3',
      title: 'Why Stories Need Monsters',
      slug: 'why-stories-need-monsters',
      excerpt: 'A short note on fear as a compass.',
      content: `# Why Stories Need Monsters

Every good story needs a monster. Not always the literal kind with fangs and claws, though those have their place. I'm talking about the thing that makes the protagonist's heart race, that forces them to confront what they'd rather avoid, that serves as the dark mirror reflecting their deepest fears.

## The Monster as Teacher

Monsters in stories do what monsters in life do: they teach us about ourselves. They reveal what we value by threatening to take it away. They show us our limits by pushing us past them. They make heroes out of ordinary people by giving them something worth fighting.

But here's what I've learned about monsters, both in stories and in life: they're rarely what they first appear to be.

## The Shape-Shifting Nature of Fear

The monster that looks like failure might actually be perfectionism in disguise. The monster that looks like rejection might be the fear of being truly seen. The monster that looks like not having enough might be the fear of discovering we're enough just as we are.

This is why stories matter. They let us face our monsters in a safe space, to see them clearly, to understand their true nature. They let us practice being brave.

## Writing Your Own Monsters

When I'm working on a story, I always ask: What is this character most afraid of? Not spiders or heights or public speaking—though those might be the surface fears—but the deeper terror. What would devastate them? What would they do anything to avoid?

That's where I find my monster.

And then I make sure that's exactly what they have to face.

Because that's how stories work. That's how growth works. We don't become who we're meant to be by avoiding the things that scare us. We become ourselves by walking toward them, with fear as our compass, pointing us toward what matters most.

Your monsters are waiting. What story will you tell about facing them?`,
      coverImageUrl: 'https://picsum.photos/seed/monster/1200/630',
      tags: ['insight', 'stories'],
      publishedAt: '2024-08-10T12:00:00Z'
    },
    {
      id: 'p4',
      title: 'Community is a Verb',
      slug: 'community-is-a-verb',
      excerpt: "What I've learned from sharing drafts aloud.",
      content: `# Community is a Verb

For the longest time, I thought community was something that happened to you. You either found yourself in one or you didn't. You were either included or excluded. Community was a noun—a thing, a place, a group you belonged to or didn't.

Then I started reading my work aloud.

## The Vulnerability of Voice

There's something different about sharing your words in your own voice, in real time, to real faces. When you read your work aloud, you can't hide behind the page. Every pause, every stumble, every moment where your voice catches—it's all there, exposed.

I was terrified the first time I signed up for an open mic at the local bookstore. My hands shook as I held my notebook. My voice cracked on the first line. But something magical happened in that room full of strangers: they listened. Really listened.

## The Act of Witnessing

What I discovered was that community isn't something you find—it's something you create, one vulnerable moment at a time. Every time someone shares their truth and someone else receives it with attention and care, community happens.

Community is the act of showing up. It's staying present when someone's voice shakes. It's offering encouragement after someone shares something that cost them to write. It's being willing to be seen in your own imperfection.

## Building Through Story

Stories have this incredible power to dissolve the barriers between us. When I read about my grandmother's house in the desert, suddenly other people start sharing their own stories about houses that held secrets. When I write about the fear of not being enough, hands go up around the room—me too, me too, me too.

This is how community builds: through recognition. Through the moment when someone else's truth illuminates something in your own experience that you thought was yours alone.

## The Practice of Presence

I've learned that community isn't about finding "your people"—it's about becoming the kind of person who creates space for others to be themselves. It's about listening with your whole attention. It's about responding to vulnerability with vulnerability.

It's about showing up, again and again, even when it's uncomfortable. Especially when it's uncomfortable.

Community is a verb. It's something we do, not something we have. And it starts with the courage to let ourselves be heard.`,
      coverImageUrl: 'https://picsum.photos/seed/community/1200/630',
      tags: ['community', 'personal'],
      publishedAt: '2024-08-12T08:00:00Z'
    }
  ]
}

// Main ingestion function
async function ingestPosts() {
  console.log('🚀 Starting dummy posts ingestion...')
  
  try {
    // Get admin user ID
    const adminUserId = await getAdminUserId()
    console.log(`✅ Found admin user: ${adminUserId}`)
    
    // Load dummy posts
    const dummyPosts = loadDummyPosts()
    console.log(`📝 Loaded ${dummyPosts.length} dummy posts`)
    
    // Collect all unique labels
    const allLabels = [...new Set(dummyPosts.flatMap(post => post.tags || []))]
    console.log(`🏷️  Found labels: ${allLabels.join(', ')}`)
    
    // Ensure all labels exist
    const labelMap = await ensureLabels(allLabels)
    console.log(`✅ Labels ready: ${labelMap.size} total`)
    
    let created = 0
    let skipped = 0
    
    for (const dummyPost of dummyPosts) {
      try {
        // Check if post already exists by slug
        const { data: existing } = await supabase
          .from('posts')
          .select('id')
          .eq('slug', dummyPost.slug)
          .single()
        
        if (existing) {
          console.log(`⏭️  Skipping existing post: ${dummyPost.title}`)
          skipped++
          continue
        }
        
        // Convert content to rich format
        const contentRich = convertToRichContent(dummyPost.content)
        
        // Create post
        const { data: post, error: postError } = await supabase
          .from('posts')
          .insert({
            author_id: adminUserId,
            title: dummyPost.title,
            slug: dummyPost.slug,
            content_rich: contentRich,
            content_text: dummyPost.content, // Plain text for search
            excerpt: dummyPost.excerpt,
            cover_image_url: dummyPost.coverImageUrl,
            status: 'published', // Make them published by default
            created_at: dummyPost.publishedAt || new Date().toISOString()
          })
          .select('id')
          .single()
        
        if (postError) {
          console.error(`❌ Failed to create post "${dummyPost.title}":`, postError.message)
          continue
        }
        
        // Add labels
        if (dummyPost.tags && dummyPost.tags.length > 0) {
          const labelInserts = dummyPost.tags
            .filter(tag => labelMap.has(tag))
            .map(tag => ({
              post_id: post.id,
              label_id: labelMap.get(tag)
            }))
          
          if (labelInserts.length > 0) {
            const { error: labelError } = await supabase
              .from('post_labels')
              .insert(labelInserts)
            
            if (labelError) {
              console.warn(`⚠️  Failed to add labels for "${dummyPost.title}":`, labelError.message)
            }
          }
        }
        
        console.log(`✅ Created post: ${dummyPost.title}`)
        created++
        
      } catch (error) {
        console.error(`❌ Error processing post "${dummyPost.title}":`, error.message)
      }
    }
    
    console.log('')
    console.log('🎉 Ingestion completed!')
    console.log(`📊 Summary:`)
    console.log(`   • Created: ${created} posts`)
    console.log(`   • Skipped: ${skipped} posts`)
    console.log(`   • Labels: ${labelMap.size} total`)
    console.log('')
    console.log('✨ Your dummy posts are now live in Supabase!')
    
  } catch (error) {
    console.error('❌ Ingestion failed:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  ingestPosts()
}
