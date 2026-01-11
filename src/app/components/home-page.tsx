import { Button } from './ui/button';
import { Calendar, Users, Bell, ArrowRight, Zap } from 'lucide-react';
import { BookerLogo } from './booker-logo';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface HomePageProps {
  onSignIn: () => void;
}

export function HomePage({ onSignIn }: HomePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <BookerLogo className="w-8 h-8 text-indigo-600" />
              <span className="text-2xl font-bold text-gray-900">Booker</span>
            </div>
            <Button onClick={onSignIn} size="lg" className="bg-indigo-600 hover:bg-indigo-700">
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6">
              Smart Scheduling with
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                Priority-Based Invites
              </span>
            </h1>
            <div className="max-w-4xl mx-auto mb-12 grid md:grid-cols-2 gap-6">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-indigo-100 hover:shadow-xl transition-shadow">
                <div className="flex flex-col items-center text-center gap-3">
                  <span className="text-4xl">🎯</span>
                  <p className="text-lg text-gray-700 leading-relaxed">
                    Create events with <span className="font-semibold text-indigo-600">ranked invitees</span>. When someone declines, the next person automatically gets the invite.
                  </p>
                </div>
              </div>
              
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-purple-100 hover:shadow-xl transition-shadow">
                <div className="flex flex-col items-center text-center gap-3">
                  <span className="text-4xl">⚡</span>
                  <p className="text-lg text-gray-700 leading-relaxed">
                    Or skip priorities and invite <span className="font-semibold text-purple-600">everyone at once</span>—first come, first serve.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={onSignIn} size="lg" className="text-lg px-8 py-6 bg-indigo-600 hover:bg-indigo-700">
                Get Started <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
            How Booker Works
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Feature 1 */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-6">
                <Calendar className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Create Event</h3>
              <p className="text-gray-600">
                Set up your event with date, time, location, and description. Simple and intuitive.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-6">
                <Users className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Rank Invitees</h3>
              <p className="text-gray-600">
                Add invitees in order of preference. Invites cascade seamlessly—without them knowing it!
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-pink-100 mb-6">
                <Bell className="w-8 h-8 text-pink-600" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Auto-Promotion</h3>
              <p className="text-gray-600">
                When someone declines, the next person in the queue automatically receives the invite.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6">
                <Zap className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">First Come, First Serve</h3>
              <p className="text-gray-600">
                Or invite everyone at once and let the fastest responder claim the spot!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tennis Coach Example with Image */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
            Real Example: Tennis Coach
          </h2>
          <p className="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Coach Sarah needs 1 student for advanced singles practice. Here's how Booker makes it effortless:
          </p>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Step 1 */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl p-6 shadow-lg">
              <ImageWithFallback 
                src="https://images.unsplash.com/photo-1647772154087-d7e438ad6987?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZW5uaXMlMjBjb3VydCUyMGVtcHR5fGVufDF8fHx8MTc2NzQxMTg1Mnww&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Tennis court"
                className="w-full h-40 object-cover rounded-xl mb-4"
              />
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">1</div>
                <div>
                  <p className="font-semibold text-lg mb-1">Creates Event</p>
                  <p className="text-sm text-gray-700">"Advanced Singles Practice"</p>
                  <p className="text-xs text-gray-600">Saturday 2PM at Court 3</p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 shadow-lg">
              <ImageWithFallback 
                src="https://images.unsplash.com/photo-1760035435867-4f4dc47853a0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZW5uaXMlMjBwbGF5ZXJzJTIwZ3JvdXB8ZW58MXx8fHwxNzY3NDExODUzfDA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Tennis players"
                className="w-full h-40 object-cover rounded-xl mb-4"
              />
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">2</div>
                <div>
                  <p className="font-semibold text-lg mb-1">Ranks Students by Preference</p>
                  <p className="text-sm text-gray-700">1st choice: Emma</p>
                  <p className="text-sm text-gray-700">2nd choice: James</p>
                  <p className="text-sm text-gray-700">3rd choice: Olivia</p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 shadow-lg">
              <ImageWithFallback 
                src="https://images.unsplash.com/photo-1758887253250-597a8888f6be?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZW5uaXMlMjB0cmFpbmluZyUyMGxlc3NvbnxlbnwxfHx8fDE3Njc0MTE4NTN8MA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Tennis training"
                className="w-full h-40 object-cover rounded-xl mb-4"
              />
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">3</div>
                <div>
                  <p className="font-semibold text-lg mb-1">Emma Declines → James Auto-Invited</p>
                  <p className="text-sm text-gray-700">System instantly invites Priority 1</p>
                  <p className="text-xs text-gray-600">No manual follow-up needed!</p>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 shadow-lg">
              <ImageWithFallback 
                src="https://images.unsplash.com/photo-1731777349420-4fd4396bbe63?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZW5uaXMlMjBwcmFjdGljZSUyMGNvdXJ0fGVufDF8fHx8MTc2NzQxMTc4MHww&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Tennis practice session"
                className="w-full h-40 object-cover rounded-xl mb-4"
              />
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">4</div>
                <div>
                  <p className="font-semibold text-lg mb-1">James Accepts ✅</p>
                  <p className="text-sm text-gray-700">Session filled automatically</p>
                  <p className="text-xs text-gray-600">Coach Sarah saved 30 minutes!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-8">
            Why Choose Booker?
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8">
              <h3 className="text-2xl font-semibold mb-4">⚡ Save Time</h3>
              <p className="text-indigo-100">
                No more manual follow-ups. The system handles invitation cascading automatically.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8">
              <h3 className="text-2xl font-semibold mb-4">🎯 Stay Organized</h3>
              <p className="text-indigo-100">
                Track all your events and invitations in one centralized dashboard.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8">
              <h3 className="text-2xl font-semibold mb-4">🔒 Google OAuth</h3>
              <p className="text-indigo-100">
                Secure authentication with Google. No passwords to remember.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8">
              <h3 className="text-2xl font-semibold mb-4">🔔 Real-Time Updates</h3>
              <p className="text-indigo-100">
                Instant notifications when invitation status changes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Ready to Streamline Your Scheduling?
          </h2>
          <p className="text-xl text-gray-600 mb-10">
            Join Booker today and experience priority-based event management.
          </p>
          <Button onClick={onSignIn} size="lg" className="text-lg px-12 py-6 bg-indigo-600 hover:bg-indigo-700">
            Sign In with Google <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <BookerLogo className="w-6 h-6 text-indigo-400" />
            <span className="text-xl font-bold text-white">Booker</span>
          </div>
          <p className="mb-2">Smart scheduling with priority-based invitations</p>
          <p className="text-sm">© 2026 Booker. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}