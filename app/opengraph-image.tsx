import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const logo = new URL('/logo-s7.png', 'https://s7robotics.space').toString()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0e0e12 0%, #11131a 60%, #0e0e12 100%)',
          color: '#fff',
          fontFamily: 'Inter, Geist, system-ui, Segoe UI, Arial',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.15,
            background:
              'radial-gradient(circle at 80% 20%, rgba(0, 163, 255, 0.20) 0%, rgba(0, 0, 0, 0) 60%), radial-gradient(circle at 10% 90%, rgba(0, 163, 255, 0.13) 0%, rgba(0, 0, 0, 0) 55%)',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0f0f14',
              boxShadow: '0 0 0 10px #00a3ff22',
            }}
          >
            
            <img src={logo} alt="S7 Robotics" width={72} height={72} style={{ borderRadius: 999 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>S7 Robotics</div>
            <div style={{ fontSize: 28, color: '#aab', marginTop: 8 }}>LMS-платформа для менторов, учеников и родителей</div>
            <div style={{ fontSize: 24, color: '#7fbfff', marginTop: 14 }}>s7robotics.space</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
