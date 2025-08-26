import pool from './connection.js'

const seedData = [
  {
    title: "The Journey Begins",
    slug: "the-journey-begins",
    content: `
      <p>Every great story has a beginning, and this is mine. As I sit here, reflecting on the path that led me to create this space, I'm filled with both excitement and anticipation for what's to come.</p>
      
      <p>This website represents more than just a collection of words—it's a digital journal, a creative outlet, and a bridge between my thoughts and anyone who finds value in shared experiences.</p>
      
      <h2>Why Stories Matter</h2>
      
      <p>Stories have the power to connect us across time and space. They help us understand ourselves and others, providing windows into different perspectives and experiences. Through storytelling, we find common ground and celebrate our differences.</p>
      
      <p>I believe that everyone has stories worth telling, and I'm excited to share mine with you. Whether they inspire, entertain, or simply provide a moment of connection, I hope they add something meaningful to your day.</p>
      
      <p>Thank you for being here at the beginning of this journey. I can't wait to see where it takes us.</p>
    `,
    excerpt: "Every great story has a beginning, and this is mine. Join me as I embark on this journey of sharing experiences, thoughts, and reflections through the power of storytelling.",
    tags: ["personal", "journey", "storytelling", "beginning"],
    image_url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop"
  },
  {
    title: "Lessons from the Mountain",
    slug: "lessons-from-the-mountain",
    content: `
      <p>Last summer, I decided to challenge myself by hiking one of the most difficult trails in our region. What started as a physical challenge became a profound lesson in perseverance, preparation, and the power of small steps.</p>
      
      <h2>The Preparation</h2>
      
      <p>Months before the hike, I began training. Early morning runs, weekend practice hikes, and countless hours researching the trail. I learned that preparation isn't just about physical fitness—it's about mental readiness and having the right tools for the journey.</p>
      
      <h2>The Climb</h2>
      
      <p>The day of the hike arrived with perfect weather. The first few miles felt easy, almost deceptively so. But as the trail grew steeper and the air thinner, I began to understand why this mountain had such a reputation.</p>
      
      <p>There were moments when I wanted to turn back. My legs ached, my lungs burned, and the summit seemed impossibly far away. But I remembered something a fellow hiker had told me: "Don't look at the summit. Just focus on the next step."</p>
      
      <h2>The View from the Top</h2>
      
      <p>When I finally reached the summit, the view was breathtaking. But more than the physical vista, I was struck by what the journey had taught me about breaking down seemingly impossible challenges into manageable pieces.</p>
      
      <p>This experience has stayed with me, influencing how I approach everything from work projects to personal goals. Sometimes the most important lesson isn't about reaching the destination—it's about who you become on the way there.</p>
    `,
    excerpt: "A challenging mountain hike becomes a powerful metaphor for life's obstacles and the importance of taking one step at a time toward our goals.",
    tags: ["adventure", "personal growth", "hiking", "perseverance"],
    image_url: "https://images.unsplash.com/photo-1464822759844-d150baec3d56?w=800&h=400&fit=crop"
  },
  {
    title: "The Art of Slow Living",
    slug: "the-art-of-slow-living",
    content: `
      <p>In our fast-paced world, I've been experimenting with the concept of slow living—intentionally choosing to slow down and savor life's simple moments. What I've discovered has been transformative.</p>
      
      <h2>What is Slow Living?</h2>
      
      <p>Slow living isn't about doing everything slowly or being unproductive. It's about being intentional with your time and energy, focusing on what truly matters, and finding joy in everyday moments.</p>
      
      <p>It means choosing quality over quantity, depth over breadth, and presence over productivity—at least some of the time.</p>
      
      <h2>Small Changes, Big Impact</h2>
      
      <p>I started with small changes: eating breakfast without checking my phone, taking walks without podcasts, and setting aside time each day for activities that brought me joy rather than just accomplishment.</p>
      
      <p>The results were surprising. I found myself more creative, less anxious, and more connected to the people and experiences around me.</p>
      
      <h2>The Challenge of Slowing Down</h2>
      
      <p>Of course, it's not always easy. Our culture celebrates busyness, and there's often pressure to fill every moment with productivity. Learning to be comfortable with stillness and simplicity takes practice.</p>
      
      <p>But I've learned that some of life's most meaningful moments happen in the spaces between our scheduled activities—in conversations that run long, in unexpected discoveries, and in the simple pleasure of being present.</p>
      
      <h2>Finding Your Own Pace</h2>
      
      <p>Slow living looks different for everyone. For some, it might mean cooking more meals at home. For others, it could be taking up a contemplative hobby or simply learning to say no to commitments that don't align with their values.</p>
      
      <p>The key is finding what works for you and remembering that it's okay to move through life at your own pace.</p>
    `,
    excerpt: "Exploring the transformative practice of slow living and how intentionally slowing down can lead to a richer, more meaningful life.",
    tags: ["lifestyle", "mindfulness", "personal growth", "reflection"],
    image_url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop"
  },
  {
    title: "Building Connections in a Digital Age",
    slug: "building-connections-digital-age",
    content: `
      <p>Technology has revolutionized how we connect with others, but it's also created new challenges for building meaningful relationships. Here's what I've learned about fostering genuine connections in our digital world.</p>
      
      <h2>The Paradox of Connection</h2>
      
      <p>We're more connected than ever before, yet many people report feeling lonelier than previous generations. Social media allows us to stay in touch with hundreds of people, but these connections often lack the depth of face-to-face relationships.</p>
      
      <p>I've been thinking a lot about this paradox and what it means for how we build and maintain relationships in the 21st century.</p>
      
      <h2>Quality Over Quantity</h2>
      
      <p>One insight that's shaped my approach to relationships is the importance of prioritizing quality over quantity. Instead of trying to maintain superficial connections with everyone, I've focused on nurturing deeper relationships with fewer people.</p>
      
      <p>This means being more intentional about how I spend my social energy—choosing meaningful conversations over small talk, and investing time in relationships that are mutually fulfilling.</p>
      
      <h2>The Role of Technology</h2>
      
      <p>Technology isn't inherently good or bad for relationships—it's a tool. The key is using it intentionally. Video calls can bring distant friends together, but they can't replace the irreplaceable experience of being physically present with someone.</p>
      
      <p>I've found that the most meaningful digital interactions happen when technology facilitates real connection rather than replacing it.</p>
      
      <h2>Creating Space for Serendipity</h2>
      
      <p>Some of the best relationships in my life have started with unexpected encounters—chance meetings, random conversations, and serendipitous connections. Our digital lives, with their algorithms and curated feeds, can sometimes limit these opportunities.</p>
      
      <p>I've started being more intentional about creating space for these unexpected connections, whether it's striking up conversations with strangers or participating in activities where I might meet like-minded people.</p>
      
      <p>Building meaningful connections in the digital age requires intention, effort, and a willingness to be vulnerable. But the rewards—deep friendships, understanding, and a sense of belonging—are worth it.</p>
    `,
    excerpt: "Navigating the challenges and opportunities of building meaningful relationships in our increasingly connected yet often isolating digital world.",
    tags: ["relationships", "technology", "community", "reflection"],
    image_url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=400&fit=crop"
  }
]

async function seedDatabase() {
  const client = await pool.connect()
  
  try {
    console.log('Starting database seed...')
    
    // Clear existing data
    await client.query('DELETE FROM posts')
    console.log('Cleared existing posts')
    
    // Insert seed data
    for (const post of seedData) {
      const query = `
        INSERT INTO posts (title, slug, content, excerpt, tags, image_url)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, title
      `
      
      const values = [
        post.title,
        post.slug,
        post.content,
        post.excerpt,
        post.tags,
        post.image_url
      ]
      
      const result = await client.query(query, values)
      console.log(`Inserted post: ${result.rows[0].title} (ID: ${result.rows[0].id})`)
    }
    
    console.log('Database seeded successfully!')
    
  } catch (error) {
    console.error('Error seeding database:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

// Run the seed function
seedDatabase()

