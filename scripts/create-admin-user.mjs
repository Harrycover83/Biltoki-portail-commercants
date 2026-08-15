#!/usr/bin/env node
/**
 * Create admin/test users with must_change_password flag
 * Usage: SUPABASE_SERVICE_ROLE_KEY="..." node scripts/create-admin-user.mjs
 */

import { createClient } from '@supabase/supabase-js'

const ADMIN_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!ADMIN_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables:')
  console.error('   - VITE_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  console.error('')
  console.error('Export them first:')
  console.error('   export VITE_SUPABASE_URL="https://your-proj.supabase.co"')
  console.error('   export SUPABASE_SERVICE_ROLE_KEY="eyJh..."')
  process.exit(1)
}

const admin = createClient(ADMIN_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function createUserWithMustChangePassword(email, tempPassword = 'TempPass123!') {
  console.log(`\n📧 Creating user: ${email}`)

  try {
    // 1. Create auth user with must_change_password flag
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Assume email is verified for admin accounts
      user_metadata: {
        must_change_password: true,
      },
    })

    if (error) {
      console.error(`   ❌ Error: ${error.message}`)
      return
    }

    console.log(`   ✅ Auth user created: ${data.user.id}`)

    // 2. Create profile entry (optional but recommended)
    const firstName = email.split('@')[0].split('.')[0]
    const lastName = email.split('@')[0].split('.')[1] || 'Admin'

    const { error: profileError } = await admin
      .from('profiles')
      .insert({
        id: data.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        role: 'admin',
        merchant_id: null,
      })

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        // Profile already exists, skip
        console.log(`   ℹ️  Profile already exists`)
      } else {
        console.warn(`   ⚠️  Could not create profile: ${profileError.message}`)
      }
    } else {
      console.log(`   ✅ Profile created`)
    }

    console.log(`   📝 Temp password: ${tempPassword}`)
    console.log(`   ℹ️  User will be forced to change password on first login`)
  } catch (err) {
    console.error(`   ❌ Unexpected error: ${err.message}`)
  }
}

async function main() {
  console.log(`\n🔐 Supabase Admin User Creator`)
  console.log(`URL: ${ADMIN_URL}`)

  // Create test users
  await createUserWithMustChangePassword('admin@biltoki.fr')
  await createUserWithMustChangePassword('test.admin@biltoki.fr')

  console.log(`\n✅ Done!\n`)
}

main().catch(console.error)
