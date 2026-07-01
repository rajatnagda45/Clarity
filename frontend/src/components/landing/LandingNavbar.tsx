"use client";

import { motion, useScroll, useTransform, useMotionTemplate } from "framer-motion";
import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { useState, useEffect } from "react";
import { MagneticButton } from "./ui/MagneticButton";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  // Map scroll position to backdrop blur and border opacity
  const blurValue = useTransform(scrollY, [0, 50], [0, 16]);
  const blur = useMotionTemplate`blur(${blurValue}px)`;
  const bgOpacity = useTransform(scrollY, [0, 50], [0, 0.8]);
  const bgColor = useMotionTemplate`rgba(12, 15, 22, ${bgOpacity})`;
  const borderOpacity = useTransform(scrollY, [0, 50], [0, 0.1]);
  const borderColor = useMotionTemplate`rgba(255, 255, 255, ${borderOpacity})`;

  useEffect(() => {
    const updateScrolled = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", updateScrolled);
    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

  return (
    <motion.nav 
      style={{
        backdropFilter: blur,
        backgroundColor: bgColor,
        borderBottomWidth: 1,
        borderBottomColor: borderColor,
        borderBottomStyle: "solid"
      }}
      className="fixed top-0 w-full z-50 transition-all duration-300"
    >
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded bg-gradient-to-tr from-orange-500 to-purple-600 flex items-center justify-center transition-transform group-hover:scale-105">
            <span className="font-bold text-white text-sm">C</span>
          </div>
          <span className="font-bold text-lg tracking-tight text-white">Clarity</span>
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-8">
          {["Platform", "Pipeline", "Trust", "Customers"].map((item) => (
            <Link 
              key={item} 
              href={`/#${item.toLowerCase()}`}
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors relative group"
            >
              {item}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-orange-500 transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
          <Link 
            href="/pricing"
            className="text-sm font-medium text-gray-300 hover:text-white transition-colors relative group"
          >
            Pricing
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-orange-500 transition-all duration-300 group-hover:w-full" />
          </Link>
        </div>

        {/* Auth */}
        <div className="flex items-center gap-4">
          <SignInButton mode="modal">
            <button className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Log in
            </button>
          </SignInButton>
          <MagneticButton intensity={0.1}>
            <SignInButton mode="modal">
              <button className="text-sm font-semibold bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors shadow-lg">
                Get Started
              </button>
            </SignInButton>
          </MagneticButton>
        </div>
      </div>
    </motion.nav>
  );
}
