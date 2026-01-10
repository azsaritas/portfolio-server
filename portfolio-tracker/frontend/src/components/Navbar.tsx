'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { Menu, X, User, LogOut, ChevronDown, Wallet, Plus } from 'lucide-react';

export default function Navbar() {
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();
  const { openAddModal } = useUI();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setIsProfileDropdownOpen(false);
  };

  return (
    <nav className="border-b border-gray-800 bg-black/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => router.push('/')}>
            <div className="bg-gradient-to-tr from-blue-600 to-purple-600 p-2 rounded-xl mr-3 shadow-lg shadow-blue-900/20">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              PortfolioX
            </span>
          </div>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center space-x-4">
             {/* Add Transaction Button */}
             <button 
                onClick={openAddModal}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg shadow-blue-900/30 transition-all flex items-center space-x-2 active:scale-95"
             >
                <Plus className="w-4 h-4" />
                <span>İşlem Ekle</span>
             </button>

            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center space-x-3 bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded-full transition-all border border-gray-800"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm font-medium text-gray-300">
                    {user?.email?.split('@')[0]}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-900 rounded-xl shadow-2xl py-1 ring-1 ring-black ring-opacity-5 border border-gray-800 overflow-hidden transform transition-all">
                    <div className="px-4 py-3 border-b border-gray-800">
                      <p className="text-sm text-white font-medium">Hesabım</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                    {/* 
                    <a href="/profile" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
                      Profil Ayarları
                    </a>
                    */}
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-400/10 hover:text-red-300 transition-colors"
                    >
                      <div className="flex items-center">
                        <LogOut className="w-4 h-4 mr-2" />
                        Çıkış Yap
                      </div>
                    </button>
                  </div>
                )}
              </div>
            ) : (
                <div className="flex items-center space-x-3">
                    <div className="hidden lg:flex items-center px-3 py-1 bg-gray-900/50 border border-gray-800 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-yellow-500/50 animate-pulse mr-2"></span>
                        <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">Misafir Modu</span>
                    </div>
                    <div className="h-6 w-px bg-gray-800 mx-2 hidden lg:block"></div>
                    <button
                        onClick={() => router.push('/login')}
                        className="text-gray-300 hover:text-white font-medium text-sm px-4 py-2 rounded-full hover:bg-white/5 transition-all"
                    >
                        Giriş Yap
                    </button>
                    <button
                        onClick={() => router.push('/register')}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-full font-bold text-sm shadow-lg shadow-blue-900/30 transition-all hover:scale-105 active:scale-95 border border-blue-500/50"
                    >
                        Kayıt Ol
                    </button>
                </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-2">
            {/* Add Transaction Button - Always Visible on Mobile */}
            <button
              onClick={() => openAddModal()}
              className="flex items-center justify-center p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all active:scale-95 shadow-md"
              title="Yeni İşlem Ekle"
            >
              <Plus className="h-5 w-5" />
            </button>
            
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 focus:outline-none"
            >
              {isMobileMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-gray-900 border-b border-gray-800">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
             {isAuthenticated ? (
                 <>
                     <button
                        onClick={() => { openAddModal(); setIsMobileMenuOpen(false); }}
                        className="w-full text-left bg-blue-600 text-white block px-3 py-3 rounded-md text-base font-bold hover:bg-blue-500 transition-colors mb-2"
                    >
                        <div className="flex items-center justify-center">
                             <Plus className="w-5 h-5 mr-2" />
                             Yeni İşlem Ekle
                        </div>
                    </button>
                    <div className="flex items-center space-x-3 px-3 py-3 border-b border-gray-800 mb-2">
                         <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
                            {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                            <div className="text-base font-medium text-white">{user?.email?.split('@')[0]}</div>
                            <div className="text-sm font-medium text-gray-500">{user?.email}</div>
                        </div>
                    </div>
                     <button
                        onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                        className="w-full text-left bg-red-500/10 text-red-400 block px-3 py-3 rounded-md text-base font-medium hover:bg-red-500/20 transition-colors"
                    >
                        <div className="flex items-center">
                             <LogOut className="w-5 h-5 mr-3" />
                             Çıkış Yap
                        </div>
                    </button>
                 </>
             ) : (
                 <div className="space-y-2 p-2">
                      <button
                        onClick={() => router.push('/login')}
                        className="w-full block text-center px-4 py-3 rounded-xl border border-gray-700 text-white font-medium hover:bg-gray-800 transition-colors"
                    >
                        Giriş Yap
                    </button>
                    <button
                        onClick={() => router.push('/register')}
                        className="w-full block text-center px-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20"
                    >
                        Ücretsiz Kayıt Ol
                    </button>
                 </div>
             )}
          </div>
        </div>
      )}
    </nav>
  );
}
