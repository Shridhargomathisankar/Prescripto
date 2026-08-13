import { useState, useEffect, useCallback, useRef } from 'react';

const MOCK_SLIDES = [
  {
    id: 'slide-1',
    icon: '💙',
    title: 'Stay hydrated.',
    description: 'Drink at least 2–3 litres of water every day to maintain optimal health & energy.',
    buttonText: 'Learn More',
    actionView: 'settings',
    isSponsored: false,
    bgGradient: 'from-blue-600 via-sky-600 to-indigo-600',
  },
  {
    id: 'slide-2',
    icon: '🏥',
    title: 'Book your annual health check-up.',
    description: 'Early detection prevents major health risks. Schedule a check-up near you.',
    buttonText: 'Book Now',
    actionView: 'maps',
    isSponsored: false,
    bgGradient: 'from-teal-600 via-emerald-600 to-cyan-600',
  },
  {
    id: 'slide-3',
    icon: '💊',
    title: 'Never miss your medicine.',
    description: 'Enable custom medicine reminders directly from Prescripto for your routine.',
    buttonText: 'Set Reminder',
    actionView: 'reminders',
    isSponsored: false,
    bgGradient: 'from-sky-600 via-blue-600 to-teal-600',
  },
  {
    id: 'slide-4',
    icon: '🩺',
    title: 'Apollo Pharmacy Offer',
    description: 'Get 20% Discount on all essential Medicines with Prescripto health card.',
    buttonText: 'View Offer',
    actionView: 'medicine-status',
    isSponsored: true,
    sponsorName: 'Apollo Pharmacy',
    bgGradient: 'from-blue-700 via-indigo-700 to-sky-700',
  },
  {
    id: 'slide-5',
    icon: '❤️',
    title: 'Health Insurance Plans',
    description: "Secure your family's future with comprehensive medical & hospital coverage.",
    buttonText: 'Explore',
    actionView: 'maps',
    isSponsored: true,
    sponsorName: 'Health Insurance',
    bgGradient: 'from-indigo-600 via-blue-600 to-teal-600',
  },
  {
    id: 'slide-6',
    icon: '🧘',
    title: 'Daily Health Tip',
    description: 'Walk for 30 minutes every day to boost your heart health and mental wellness.',
    buttonText: 'Know More',
    actionView: 'reports',
    isSponsored: false,
    bgGradient: 'from-emerald-600 via-teal-600 to-sky-600',
  },
];

export default function HealthBannerCarousel({ banners = MOCK_SLIDES, onActionClick }) {
  const slides = banners && banners.length > 0 ? banners : MOCK_SLIDES;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  // Touch Swipe Handlers for Mobile
  const handleTouchStart = (e) => {
    setIsPaused(true);
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 40;
    const isRightSwipe = distance < -40;

    if (isLeftSwipe) {
      nextSlide();
    } else if (isRightSwipe) {
      prevSlide();
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  // Auto slide every 5 seconds (5000ms)
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide]);

  const currentSlide = slides[currentIndex] || slides[0];

  return (
    <div
      className="relative w-full rounded-3xl overflow-hidden shadow-md my-4 group transition-all duration-300 touch-pan-y"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background with subtle animation */}
      <div
        className={`w-full px-5 py-5 sm:px-6 sm:py-7 text-white bg-gradient-to-r ${
          currentSlide.bgGradient || 'from-blue-600 to-sky-600'
        } transition-all duration-500 flex flex-col justify-between min-h-[160px] sm:min-h-[170px]`}
      >
        {/* Top bar: Icon/Badge */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl sm:text-3xl drop-shadow-xs">{currentSlide.icon || '💙'}</span>
            {currentSlide.isSponsored && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-200 border border-amber-300/30 backdrop-blur-xs shadow-xs">
                Sponsored • {currentSlide.sponsorName || 'Ad'}
              </span>
            )}
          </div>
          {/* Pause Indicator when hovered */}
          {isPaused && (
            <span className="text-[10px] font-medium bg-black/20 px-2 py-0.5 rounded-full text-white/80 animate-pulse hidden sm:inline-block">
              Paused on hover
            </span>
          )}
        </div>

        {/* Content */}
        <div className="space-y-1 my-1">
          <h3 className="text-base sm:text-xl font-bold tracking-tight text-white leading-snug">
            {currentSlide.title}
          </h3>
          <p className="text-xs sm:text-sm text-blue-50/90 leading-relaxed max-w-xl line-clamp-2">
            {currentSlide.description}
          </p>
        </div>

        {/* Bottom bar: Button & Navigation Dots */}
        <div className="flex items-center justify-between gap-3 pt-3">
          {currentSlide.buttonText && (
            <button
              type="button"
              onClick={() => {
                if (onActionClick) {
                  onActionClick(currentSlide);
                }
              }}
              className="px-4 py-2 rounded-full bg-white text-slate-800 hover:bg-blue-50 text-xs font-bold shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 min-h-[38px]"
            >
              <span>{currentSlide.buttonText}</span>
              <span className="text-blue-600 font-extrabold">→</span>
            </button>
          )}

          {/* Navigation Controls & Pagination Dots */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Prev arrow */}
            <button
              type="button"
              onClick={prevSlide}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center text-sm transition backdrop-blur-xs min-h-[32px] min-w-[32px]"
              title="Previous slide"
            >
              ‹
            </button>

            {/* Dots */}
            <div className="flex items-center gap-1.5 px-1">
              {slides.map((s, idx) => (
                <button
                  key={s.id || idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentIndex
                      ? 'w-6 bg-white shadow-xs'
                      : 'w-2 bg-white/40 hover:bg-white/70'
                  }`}
                  title={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            {/* Next arrow */}
            <button
              type="button"
              onClick={nextSlide}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center text-sm transition backdrop-blur-xs min-h-[32px] min-w-[32px]"
              title="Next slide"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
