'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-purple-50 to-blue-50">
        <h1 className="text-6xl font-bold mb-6 text-center bg-gradient-to-r from-purple-600 to-blue-600 text-transparent bg-clip-text">
          DanceFrame 💃
        </h1>

        <p className="text-2xl text-gray-700 mb-12 text-center max-w-2xl">
          手描きアニメーションと踊る<br />
          AI駆動型動画生成アプリ
        </p>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12 max-w-4xl">
          <FeatureCard
            icon="🎨"
            title="動画解析"
            description="AIが自動でユニークなポーズを検出"
          />
          <FeatureCard
            icon="📸"
            title="リアルタイム撮影"
            description="カメラでポーズを真似して自動シャッター"
          />
          <FeatureCard
            icon="🎬"
            title="自動合成"
            description="あなただけの踊ってみた動画を生成"
          />
        </div>

        {/* CTA Button */}
        <Link href="/upload">
          <button className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xl font-semibold rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105">
            さっそく始める →
          </button>
        </Link>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
      <div className="text-5xl mb-4 text-center">{icon}</div>
      <h3 className="text-xl font-semibold mb-2 text-center">{title}</h3>
      <p className="text-gray-600 text-center">{description}</p>
    </div>
  );
}
