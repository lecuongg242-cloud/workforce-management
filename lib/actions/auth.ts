'use server';

import { createClient } from '@/lib/supabase/server';
import { signUpSchema, signInSchema, type SignUpInput, type SignInInput } from '@/lib/validations';
import { redirect } from 'next/navigation';

export async function signUp(input: SignUpInput) {
  try {
    const validatedInput = signUpSchema.parse(input);
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
      email: validatedInput.email,
      password: validatedInput.password,
      options: {
        data: {
          first_name: validatedInput.firstName,
          last_name: validatedInput.lastName,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      message: 'Sign up successful! Please check your email to confirm.',
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

export async function signIn(input: SignInInput) {
  try {
    const validatedInput = signInSchema.parse(input);
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: validatedInput.email,
      password: validatedInput.password,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    redirect('/dashboard');
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/auth/login');
  } catch (error) {
    console.error('Sign out error:', error);
    return {
      success: false,
      error: 'Failed to sign out',
    };
  }
}

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function getCurrentUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
