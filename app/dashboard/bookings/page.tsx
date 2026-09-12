import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import NewBookingsClient from "./NewBookingsClient";
export default async function BookingsPage(){const sb=await getSupabaseServerClient();const {data:{user}}=await sb.auth.getUser();if(!user)redirect('/login');return <NewBookingsClient/>}
