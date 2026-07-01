export function Footer() {
  return (
    <footer className="bg-[#05070B] border-t border-white/5 pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 mb-16">
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-6 h-6 rounded bg-gradient-to-tr from-orange-500 to-purple-600 flex items-center justify-center">
                <span className="font-bold text-white text-xs">C</span>
              </div>
              <span className="font-bold text-lg text-white tracking-tight">
                Clarity AI Docs
              </span>
            </div>
            <p className="text-sm text-gray-500 max-w-sm">
              Self-auditing contract intelligence. Every claim verified against the source. Every answer carries a measured trust score.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-3 text-sm text-gray-500">
              <li><a href="/#platform" className="hover:text-white transition-colors">Platform</a></li>
              <li><a href="/#pipeline" className="hover:text-white transition-colors">The Pipeline</a></li>
              <li><a href="/#trust" className="hover:text-white transition-colors">Verifiable Trust</a></li>
              <li><a href="/pricing" className="hover:text-white transition-colors">Pricing</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-semibold mb-4">Enterprise</h4>
            <ul className="space-y-3 text-sm text-gray-500">
              <li><a href="/#security" className="hover:text-white transition-colors">Security</a></li>
              <li><a href="/#workspace" className="hover:text-white transition-colors">Workspace</a></li>
              <li><a href="/#observability" className="hover:text-white transition-colors">Observability</a></li>
              <li><a href="/#reasoning" className="hover:text-white transition-colors">Reasoning Engine</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-3 text-sm text-gray-500">
              <li><a href="/#customers" className="hover:text-white transition-colors">Customers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/5 text-sm text-gray-600">
          <p>© {new Date().getFullYear()} Clarity AI. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-gray-300 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
