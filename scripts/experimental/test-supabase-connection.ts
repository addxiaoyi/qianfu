/**
 * 可选连通性脚本：主业务不依赖 Supabase。
 * 使用：在 .env 配置 SUPABASE_URL、SUPABASE_ANON_KEY 后运行
 * tsx scripts/experimental/test-supabase-connection.ts
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log('Testing Supabase Connection...');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseAnonKey ? 'Present' : 'Missing');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Connection failed:', error.message);
    } else {
      console.log('Connection successful!');
      console.log('Session data:', data);
    }
  } catch (err: any) {
    console.error('Unexpected error:', err.message);
  }
}

testConnection();
