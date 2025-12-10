export const PageFooter = () => {
    return (
        <>
            <div className="w-full h-2 bg-gradient-to-r  from-violet-500 to-rose-400" />
            <footer className="flex items-center justify-between gap-2 p-6 border-t border-fd-border">
                <p className="opacity-75 text-sm">&copy; {new Date().getFullYear()} Pyth Network. All rights reserved.</p>
                <p className="opacity-75 text-sm">Privacy Policy | Terms of Use</p>
            </footer>
        </>)
}