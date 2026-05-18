/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require('pg');

async function createDatabase() {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    password: '5330',
    port: 5432,
    database: 'postgres', // Connect to default postgres db first
  });

  try {
    await client.connect();
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'sistema_horarios'");
    if (res.rowCount === 0) {
      await client.query('CREATE DATABASE sistema_horarios');
      console.log('Database sistema_horarios created successfully');
    } else {
      console.log('Database sistema_horarios already exists');
    }
  } catch (err) {
    console.error('Error creating database:', err);
  } finally {
    await client.end();
  }
}

createDatabase();
