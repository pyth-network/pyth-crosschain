import React, { useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';

const cumulativeVolumeData = [
  { month: 'Jan 24', volume: 153.3 },
  { month: 'Mar 24', volume: 299.4 },
  { month: 'Jun 24', volume: 599.0 },
  { month: 'Sep 24', volume: 842.1 },
  { month: 'Dec 24', volume: 1135.7 },
  { month: 'Mar 25', volume: 1435.1 },
  { month: 'Jun 25', volume: 1674.6 },
  { month: 'Sep 25', volume: 1978.9 },
  { month: 'Dec 25', volume: 2400.3 },
];

const stakingData = [
  { month: 'Oct 24', staked: 229 },
  { month: 'Nov 24', staked: 237 },
  { month: 'Dec 24', staked: 231 },
  { month: 'Jan 25', staked: 333 },
  { month: 'Feb 25', staked: 350 },
  { month: 'Mar 25', staked: 611 },
  { month: 'Apr 25', staked: 529 },
  { month: 'May 25', staked: 629 },
  { month: 'Jun 25', staked: 954 },
  { month: 'Jul 25', staked: 942 },
  { month: 'Aug 25', staked: 946 },
  { month: 'Sep 25', staked: 945 },
  { month: 'Oct 25', staked: 955 },
  { month: 'Nov 25', staked: 955 },
  { month: 'Dec 25', staked: 957 },
];

const priceFeedsData = [
  { month: 'Feb 25', Crypto: 601, Equities: 646, FX: 16, Commodities: 13, Rates: 9 },
  { month: 'Apr 25', Crypto: 642, Equities: 711, FX: 30, Commodities: 16, Rates: 15 },
  { month: 'Jun 25', Crypto: 667, Equities: 905, FX: 45, Commodities: 16, Rates: 15 },
  { month: 'Aug 25', Crypto: 723, Equities: 1393, FX: 46, Commodities: 14, Rates: 15 },
  { month: 'Oct 25', Crypto: 747, Equities: 1653, FX: 287, Commodities: 49, Rates: 15 },
  { month: 'Dec 25', Crypto: 755, Equities: 1694, FX: 290, Commodities: 79, Rates: 35 },
];

const rwaEquityData = [
  { month: 'Dec 23', RWA: 4, Equity: 2 },
  { month: 'Jun 24', RWA: 11, Equity: 3 },
  { month: 'Dec 24', RWA: 20, Equity: 8 },
  { month: 'Mar 25', RWA: 24, Equity: 12 },
  { month: 'Jun 25', RWA: 36, Equity: 24 },
  { month: 'Sep 25', RWA: 40, Equity: 28 },
  { month: 'Dec 25', RWA: 52, Equity: 39 },
];

const tvsMonthlyData = [
  { month: 'Jan', tvs: 16.9 },
  { month: 'Feb', tvs: 15.3 },
  { month: 'Mar', tvs: 14.5 },
  { month: 'Apr', tvs: 15.5 },
  { month: 'May', tvs: 16.6 },
  { month: 'Jun', tvs: 16.2 },
  { month: 'Jul', tvs: 20.9 },
  { month: 'Aug', tvs: 25.2 },
  { month: 'Sep', tvs: 24.5 },
  { month: 'Oct', tvs: 22.0 },
  { month: 'Nov', tvs: 16.9 },
  { month: 'Dec', tvs: 16.1 },
];

const volumeMonthlyData = [
  { month: 'Jan', volume: 132.1 },
  { month: 'Feb', volume: 92.2 },
  { month: 'Mar', volume: 75.2 },
  { month: 'Apr', volume: 67.1 },
  { month: 'May', volume: 82.6 },
  { month: 'Jun', volume: 89.7 },
  { month: 'Jul', volume: 94.9 },
  { month: 'Aug', volume: 99.4 },
  { month: 'Sep', volume: 132.4 },
  { month: 'Oct', volume: 195.1 },
  { month: 'Nov', volume: 123.5 },
  { month: 'Dec', volume: 103.4 },
];

const tvsByChainData = [
  { name: 'Ethereum', value: 110441, color: '#627EEA' },
  { name: 'Solana', value: 71803, color: '#14F195' },
  { name: 'Sui', value: 13933, color: '#6FBCF0' },
  { name: 'Aptos', value: 8092, color: '#2ED8A7' },
  { name: 'Others', value: 16200, color: '#94A3B8' },
];

const tvsByCategoryData = [
  { name: 'Basis Trading', value: 95047, color: '#8B5CF6' },
  { name: 'Lending', value: 78454, color: '#06B6D4' },
  { name: 'Derivatives', value: 41284, color: '#F59E0B' },
  { name: 'Others', value: 5684, color: '#94A3B8' },
];

const volumeByChainData = [
  { chain: 'Solana', volume: 484 },
  { chain: 'BNB', volume: 158 },
  { chain: 'Base', volume: 141 },
  { chain: 'Paradex', volume: 107 },
  { chain: 'StarkEX', volume: 57 },
  { chain: 'Others', volume: 341 },
];

const entropyData = [
  { month: 'Jan', requests: 0.25 },
  { month: 'Feb', requests: 0.32 },
  { month: 'Mar', requests: 1.06 },
  { month: 'Apr', requests: 1.33 },
  { month: 'May', requests: 1.17 },
  { month: 'Jun', requests: 1.14 },
  { month: 'Jul', requests: 0.95 },
  { month: 'Aug', requests: 0.81 },
  { month: 'Sep', requests: 0.66 },
  { month: 'Oct', requests: 0.60 },
  { month: 'Nov', requests: 0.13 },
  { month: 'Dec', requests: 0.48 },
];

const appsMonthlyData = [
  { month: 'Jan', apps: 27 },
  { month: 'Feb', apps: 21 },
  { month: 'Mar', apps: 17 },
  { month: 'Apr', apps: 17 },
  { month: 'May', apps: 10 },
  { month: 'Jun', apps: 16 },
  { month: 'Jul', apps: 17 },
  { month: 'Aug', apps: 11 },
  { month: 'Sep', apps: 14 },
  { month: 'Oct', apps: 15 },
  { month: 'Nov', apps: 18 },
  { month: 'Dec', apps: 13 },
];

const appsByCategoryData = [
  { name: 'Derivatives', value: 53, color: '#8B5CF6' },
  { name: 'Lending', value: 34, color: '#06B6D4' },
  { name: 'Gaming', value: 21, color: '#F59E0B' },
  { name: 'DEXes', value: 10, color: '#10B981' },
  { name: 'Synthetics', value: 10, color: '#EC4899' },
  { name: 'Trading', value: 9, color: '#6366F1' },
  { name: 'Prediction', value: 8, color: '#14B8A6' },
  { name: 'Others', value: 51, color: '#94A3B8' },
];

const appsByChainData = [
  { chain: 'Solana', apps: 32 },
  { chain: 'Off-Chain', apps: 21 },
  { chain: 'Monad', apps: 20 },
  { chain: 'HyperEVM', apps: 16 },
  { chain: 'Berachain', apps: 12 },
  { chain: 'Base', apps: 11 },
  { chain: 'Sui', apps: 9 },
  { chain: 'Arbitrum', apps: 9 },
  { chain: 'Others', apps: 66 },
];

const connectedChainsData = [
  { month: 'Dec 22', chains: 10 },
  { month: 'Jun 23', chains: 30 },
  { month: 'Dec 23', chains: 55 },
  { month: 'Jun 24', chains: 75 },
  { month: 'Dec 24', chains: 97 },
  { month: 'Jun 25', chains: 105 },
  { month: 'Dec 25', chains: 113 },
];

const kpiScorecardData = [
  { metric: 'Cumulative Volume', jan: '$1.14T', dec: '$2.40T', growth: '+111%' },
  { metric: 'PYTH Staked', jan: '333M', dec: '957M', growth: '+187%' },
  { metric: 'Price Feeds', jan: '550', dec: '2,853', growth: '+419%' },
  { metric: 'RWA Users', jan: '20', dec: '52', growth: '+160%' },
  { metric: 'Equity Users', jan: '8', dec: '39', growth: '+388%' },
  { metric: 'App Integrations', jan: '469', dec: '665', growth: '+42%' },
  { metric: 'Connected Chains', jan: '97', dec: '113', growth: '+16%' },
  { metric: 'Entropy Requests', jan: '0.25M', dec: '0.48M', growth: '+92%' },
];

const COLORS = ['#8B5CF6', '#06B6D4', '#F59E0B', '#10B981', '#EC4899', '#94A3B8'];

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');

  const StatCard = ({ title, value, change, subtitle }) => (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <p className="text-gray-500 text-sm font-medium">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <div className="flex items-center mt-2">
        <span className={`text-sm font-semibold ${change.startsWith('+') ? 'text-emerald-600' : change.startsWith('-') ? 'text-red-500' : 'text-gray-500'}`}>
          {change}
        </span>
        {subtitle && <span className="text-gray-400 text-sm ml-2">{subtitle}</span>}
      </div>
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Cumulative Volume" value="$2.40T" change="+111%" subtitle="YoY" />
        <StatCard title="PYTH Staked" value="957M" change="+187%" subtitle="YoY" />
        <StatCard title="Price Feeds" value="2,853" change="+419%" subtitle="YoY" />
        <StatCard title="Protocol TVS" value="$16.1B" change="+5.7%" subtitle="Dec" />
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="RWA Users" value="52" change="+160%" subtitle="YoY" />
        <StatCard title="Equity Users" value="39" change="+388%" subtitle="YoY" />
        <StatCard title="Apps Integrated" value="196" change="+42%" subtitle="in 2025" />
        <StatCard title="Entropy Requests" value="8.9M" change="+256%" subtitle="YoY" />
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cumulative Traded Volume</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={cumulativeVolumeData}>
            <defs>
              <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
            <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" tickFormatter={(v) => `$${v}B`} />
            <Tooltip formatter={(v) => [`$${v.toFixed(1)}B`, 'Volume']} />
            <Area type="monotone" dataKey="volume" stroke="#8B5CF6" strokeWidth={3} fill="url(#volumeGradient)" />
          </AreaChart>
        </ResponsiveContainer>
        <p className="text-center text-gray-500 text-sm mt-2">+$1.26T added in 2025 alone</p>
      </div>
    </div>
  );

  const renderStaking = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Jan 2025" value="333M" change="+44%" subtitle="from Dec" />
        <StatCard title="Peak (Jun)" value="954M" change="+186%" subtitle="from Jan" />
        <StatCard title="Dec 2025" value="957M" change="+187%" subtitle="YoY" />
      </div>
      
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">PYTH Token Staking Growth</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={stakingData}>
            <defs>
              <linearGradient id="stakingGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" tickFormatter={(v) => `${v}M`} />
            <Tooltip formatter={(v) => [`${v}M PYTH`, 'Staked']} />
            <Area type="monotone" dataKey="staked" stroke="#10B981" strokeWidth={3} fill="url(#stakingGradient)" />
          </AreaChart>
        </ResponsiveContainer>
        <p className="text-center text-gray-500 text-sm mt-2">Explosive Q1 growth, stabilized at ~950M from June onward</p>
      </div>
    </div>
  );

  const renderPriceFeeds = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Equities" value="1,694" change="+162%" subtitle="" />
        <StatCard title="Crypto" value="755" change="+26%" subtitle="" />
        <StatCard title="FX" value="290" change="+1,713%" subtitle="" />
        <StatCard title="Commodities" value="79" change="+508%" subtitle="" />
        <StatCard title="Rates" value="35" change="+289%" subtitle="" />
      </div>
      
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Feeds by Asset Class (2025)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={priceFeedsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
            <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="Equities" stackId="1" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} />
            <Area type="monotone" dataKey="Crypto" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} />
            <Area type="monotone" dataKey="FX" stackId="1" stroke="#06B6D4" fill="#06B6D4" fillOpacity={0.6} />
            <Area type="monotone" dataKey="Commodities" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
            <Area type="monotone" dataKey="Rates" stackId="1" stroke="#EC4899" fill="#EC4899" fillOpacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
        <p className="text-center text-gray-500 text-sm mt-2">Equities dominated expansion; FX exploded in October (+241 feeds)</p>
      </div>
    </div>
  );

  const renderRWA = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="RWA Users" value="52" change="+160%" subtitle="YoY" />
        <StatCard title="Equity Users" value="39" change="+388%" subtitle="YoY" />
        <StatCard title="Pro Tier" value="12" change="22.6%" subtitle="penetration" />
        <StatCard title="New in 2025" value="32" change="+62%" subtitle="protocols" />
      </div>
      
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">RWA & Equity User Growth</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={rwaEquityData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
            <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" />
            <Tooltip />
            <Legend />
            <Bar dataKey="RWA" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="Equity" stroke="#F59E0B" strokeWidth={3} dot={{ fill: '#F59E0B', r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-center text-gray-500 text-sm mt-2">Fastest growing segments — validating TradFi-to-DeFi thesis</p>
      </div>
    </div>
  );

  const renderTVS = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Q1 TVS" value="$46.6B" change="" subtitle="" />
        <StatCard title="Q2 TVS" value="$48.3B" change="+3.6%" subtitle="QoQ" />
        <StatCard title="Q3 TVS (Peak)" value="$70.6B" change="+46%" subtitle="QoQ" />
        <StatCard title="Q4 TVS" value="$55.0B" change="-22%" subtitle="QoQ" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly TVS ($B)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={tvsMonthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" tickFormatter={(v) => `$${v}B`} />
              <Tooltip formatter={(v) => [`$${v}B`, 'TVS']} />
              <Bar dataKey="tvs" fill="#06B6D4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">TVS by Chain (2025)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={tvsByChainData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {tvsByChainData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`$${(v/1000).toFixed(1)}B`, 'TVS']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">TVS by Category (2025)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={tvsByCategoryData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {tvsByCategoryData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => [`$${(v/1000).toFixed(1)}B`, 'TVS']} />
          </PieChart>
        </ResponsiveContainer>
        <p className="text-center text-gray-500 text-sm mt-2">Basis Trading (43%) emerged as largest category — delta-neutral strategies rely on Pyth</p>
      </div>
    </div>
  );

  const renderVolume = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="2025 Total" value="$1.29T" change="+27%" subtitle="YoY" />
        <StatCard title="Peak Month" value="$195B" change="Oct" subtitle="" />
        <StatCard title="Q4 Volume" value="$422B" change="+29%" subtitle="QoQ" />
        <StatCard title="Solana Share" value="37.6%" change="#1" subtitle="chain" />
      </div>
      
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Protocol Volume ($B)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={volumeMonthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
            <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" tickFormatter={(v) => `$${v}B`} />
            <Tooltip formatter={(v) => [`$${v}B`, 'Volume']} />
            <Bar dataKey="volume" fill="#F59E0B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-center text-gray-500 text-sm mt-2">October spike ($195B) driven by BTC price action and derivatives activity</p>
      </div>
      
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Volume by Blockchain ($B)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={volumeByChainData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9CA3AF" tickFormatter={(v) => `$${v}B`} />
            <YAxis type="category" dataKey="chain" tick={{ fontSize: 12 }} stroke="#9CA3AF" width={70} />
            <Tooltip formatter={(v) => [`$${v}B`, 'Volume']} />
            <Bar dataKey="volume" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderApps = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="New in 2025" value="196" change="+42%" subtitle="apps" />
        <StatCard title="Total Apps" value="665" change="" subtitle="all-time" />
        <StatCard title="Peak Month" value="27" change="Jan" subtitle="" />
        <StatCard title="Top Category" value="Derivatives" change="53" subtitle="apps" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly App Integrations (2025)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={appsMonthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" />
              <Tooltip formatter={(v) => [v, 'Apps']} />
              <Bar dataKey="apps" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Apps by Category (2025)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={appsByCategoryData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {appsByCategoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [v, 'Apps']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Apps by Blockchain (2025)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={appsByChainData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
            <YAxis type="category" dataKey="chain" tick={{ fontSize: 12 }} stroke="#9CA3AF" width={80} />
            <Tooltip formatter={(v) => [v, 'Apps']} />
            <Bar dataKey="apps" fill="#06B6D4" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-center text-gray-500 text-sm mt-2">Solana leads (32), but Monad (20) shows strong pre-launch ecosystem momentum</p>
      </div>
    </div>
  );

  const renderEntropy = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="2025 Total" value="8.9M" change="+256%" subtitle="YoY" />
        <StatCard title="Peak Month" value="1.33M" change="Apr" subtitle="" />
        <StatCard title="Dec 2025" value="0.48M" change="" subtitle="" />
      </div>
      
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Entropy (VRF) Monthly Requests (Millions)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={entropyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
            <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" tickFormatter={(v) => `${v}M`} />
            <Tooltip formatter={(v) => [`${v}M`, 'Requests']} />
            <Bar dataKey="requests" fill="#EC4899" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-center text-gray-500 text-sm mt-2">Peak in Q1-Q2 (Mar-Apr), driven by gaming integrations; normalized in H2</p>
      </div>
    </div>
  );

  const renderScorecard = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">2025 Year-End Scorecard</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-600">Metric</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-600">Jan 2025</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-600">Dec 2025</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-600">Growth</th>
              </tr>
            </thead>
            <tbody>
              {kpiScorecardData.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{row.metric}</td>
                  <td className="py-3 px-4 text-right text-gray-600">{row.jan}</td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900">{row.dec}</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-600">{row.growth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Connected Blockchains</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={connectedChainsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
            <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" />
            <Tooltip />
            <Line type="monotone" dataKey="chains" stroke="#8B5CF6" strokeWidth={3} dot={{ fill: '#8B5CF6', r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-center text-gray-500 text-sm mt-2">113 chains connected — most ubiquitous oracle in crypto</p>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'staking', label: 'Staking' },
    { id: 'feeds', label: 'Price Feeds' },
    { id: 'rwa', label: 'RWA/Equity' },
    { id: 'apps', label: 'Apps' },
    { id: 'tvs', label: 'TVS' },
    { id: 'volume', label: 'Volume' },
    { id: 'entropy', label: 'Entropy' },
    { id: 'scorecard', label: 'Scorecard' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Pyth Network 2025 KPI Dashboard</h1>
          <p className="text-gray-500 mt-1">Annual Performance Summary | January - December 2025</p>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-6 bg-white rounded-xl p-2 shadow-sm border border-gray-100">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'staking' && renderStaking()}
        {activeTab === 'feeds' && renderPriceFeeds()}
        {activeTab === 'rwa' && renderRWA()}
        {activeTab === 'apps' && renderApps()}
        {activeTab === 'tvs' && renderTVS()}
        {activeTab === 'volume' && renderVolume()}
        {activeTab === 'entropy' && renderEntropy()}
        {activeTab === 'scorecard' && renderScorecard()}
        
        <div className="mt-6 text-center text-gray-400 text-xs">
          Data sourced from Pyth Network KPI tracking sheets | Generated Jan 2026
        </div>
      </div>
    </div>
  );
}
