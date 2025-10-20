import { Router } from 'express'
import { getSupabaseAdmin } from '../auth/supabaseAdmin.ts'
import { requireUser } from '../middleware/requireUser.ts'
import type { AuthenticatedRequest } from '../middleware/requireUser.ts'

const router = Router()

// DELETE /api/admin/delete-user - Delete user account (authenticated user only, deletes their own account)
router.delete('/delete-user', requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.body
    const authenticatedUserId = req.user?.id

    // Security check: users can only delete their own account
    if (!authenticatedUserId || userId !== authenticatedUserId) {
      return res.status(403).json({ 
        error: 'You can only delete your own account' 
      })
    }

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return res.status(500).json({ 
        error: 'Supabase admin not configured' 
      })
    }

    // First, delete user's profile and related data using our RPC function
    const { error: dataError } = await supabaseAdmin.rpc('delete_user_data')
    
    if (dataError) {
      console.error('Error deleting user data:', dataError)
      return res.status(500).json({ 
        error: 'Failed to delete user data' 
      })
    }

    // Now delete the auth user using Admin API
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (authError) {
      console.error('Error deleting auth user:', authError)
      return res.status(500).json({ 
        error: 'Failed to delete user account' 
      })
    }

    console.log(`✅ User account deleted successfully: ${userId}`)
    console.log(`✅ Profile data deleted, auth user deleted from Supabase`)
    res.json({ success: true, message: 'Account deleted successfully' })

  } catch (error) {
    console.error('Error in delete-user endpoint:', error)
    res.status(500).json({ 
      error: 'Internal server error' 
    })
  }
})

export default router
