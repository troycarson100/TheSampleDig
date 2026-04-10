import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      isPro?: boolean
      /** Mirrors users.email_marketing_opt_in */
      emailMarketingOptIn?: boolean
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    email?: string
    isPro?: boolean
    emailMarketingOptIn?: boolean
  }
}
