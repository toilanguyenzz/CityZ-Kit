import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

export async function POST(request) {
  try {
    const { budget, foodType, district } = await request.json();
    if (!budget || !foodType || !district) {
      return new Response(JSON.stringify({ error: 'Thiếu tham số' }), { status: 400 });
    }

    const locationsSnap = await getDocs(collection(db, 'locations'));
    const locations = locationsSnap.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(loc => loc.status === 'approved' || !loc.status)
      .map(loc => ({
        name: loc.name,
        category: loc.category,
        address: loc.address,
        description: loc.description,
        averageRating: loc.averageRating,
      }));

    if (locations.length === 0) {
      return new Response(JSON.stringify({ recommendations: [], message: 'Chưa có địa điểm nào trong hệ thống' }));
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `
Bạn là trợ lý thông minh hỗ trợ sinh viên tại TP.HCM.
Dựa trên danh sách địa điểm JSON bên dưới, hãy gợi ý ĐÚNG 3 địa điểm phù hợp nhất cho sinh viên có ngân sách "${budget}", thích ăn "${foodType}", sống ở quận "${district}".
Trả về DUY NHẤT JSON theo định dạng: [{"name": "tên địa điểm", "reason": "lý do ngắn gọn"}]. Không thêm bất kỳ text nào khác.

Danh sách địa điểm: ${JSON.stringify(locations)}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const match = responseText.match(/\[.*\]/s);
    const jsonStr = match ? match[0] : responseText;
    const recommendations = JSON.parse(jsonStr);

    return new Response(JSON.stringify({ recommendations }), { status: 200 });
  } catch (error) {
    console.error('Gemini API Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
