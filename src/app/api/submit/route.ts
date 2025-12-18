import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Validate body
        if (!body.email) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const dataDir = path.join(process.cwd(), 'data');
        const filePath = path.join(dataDir, 'submissions.json');

        // Ensure data dir exists
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        let submissions = [];
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            try {
                submissions = JSON.parse(fileContent);
            } catch (e) {
                // file might be empty or corrupt, start fresh
                submissions = [];
            }
        }

        // Add new submission
        const newSubmission = {
            id: crypto.randomUUID(),
            ...body,
            receivedAt: new Date().toISOString(),
        };

        submissions.push(newSubmission);

        fs.writeFileSync(filePath, JSON.stringify(submissions, null, 2));

        return NextResponse.json({ success: true, id: newSubmission.id });
    } catch (error) {
        console.error('Submission error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
