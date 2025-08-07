'use client';

// --- IMPORTACIONES ---
import { useState, useEffect, useCallback, useMemo } from 'react';
import { SessionProvider, useSession, signOut } from 'next-auth/react';
import { TopBar, Marble, Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { createPublicClient, http, isAddress, formatUnits } from 'viem';
import { worldchain } from 'viem/chains';
import { walletAuth } from '@/auth/wallet'; // Asegúrate que la ruta sea correcta
import clsx from 'clsx';
import { MiniKit, useMiniKit, Tokens, tokenToDecimals, VerificationLevel, ISuccessResult } from "@worldcoin/minikit-js";
import MiningNftABI from '@/abi/miningNftABI.json'; // Asegúrate que la ruta sea correcta
import GolemsCoinABI from '@/abi/GolemsCoin.json'; // Asegúrate que la ruta sea correcta
import { Xmark, ShieldCheck } from 'iconoir-react';

// --- TRADUCCIONES ---
const translations = {
  en: {
    loginTitle: "Mining Base",
    loginSubtitle: "Log in to compete.",
    loginButton: "Log In with World App",
    pageTitle: "King of the Base",
    pageSubtitle: "Control the base with your NFT to mine tokens.",
    currentMiner: "Current Miner",
    emptyBase: "Base Empty!",
    accumulatedReward: "Accumulated Reward",
    attackButton: "Take the Base!",
    attackingButton: "Attacking...",
    cooldownButton: "On Cooldown:",
    shopButton: "Shop",
    shopTitle: "Cube Shop",
    shopChooseCube: "1. Choose your Cube",
    shopChooseCurrency: "2. Choose your Currency",
    shopPayButton: "Pay",
    selectNftTitle: "Select your Golem",
    selectNftLoading: "Searching for your Golems...",
    selectNftNone: "You have no valid Golems for this game.",
    verifyTitle: "Verification Required",
    verifySubtitle: "Verify your humanity to claim your welcome bonuses.",
    verifyButton: "Verify with World ID",
    bonusTitle: "Welcome Bonuses",
    bonusSubtitle: "Claim your initial rewards to start playing.",
    claimNftButton: "Claim Free NFT",
    claimGocButton: "Claim 10 Free GOC",
    claimed: "Claimed",
    feedbackError: "An error occurred.",
    feedbackAttacking: "Executing attack...",
    feedbackAttackSuccess: "Base captured!",
    feedbackAttackFailed: "Attack failed. Try again.",
    feedbackClaiming: "Claiming...",
    feedbackClaimSuccess: "Successfully claimed!",
  },
  es: {
    loginTitle: "Base de Minado",
    loginSubtitle: "Inicia sesión para competir.",
    loginButton: "Iniciar Sesión con World App",
    pageTitle: "Rey de la Base",
    pageSubtitle: "Controla la base con tu NFT para minar tokens.",
    currentMiner: "Minero Actual",
    emptyBase: "¡Base Vacía!",
    accumulatedReward: "Recompensa Acumulada",
    attackButton: "¡Tomar la Base!",
    attackingButton: "Atacando...",
    cooldownButton: "En Cooldown:",
    shopButton: "Tienda",
    shopTitle: "Tienda de Cubos",
    shopChooseCube: "1. Elige tu Cubo",
    shopChooseCurrency: "2. Elige tu Moneda",
    shopPayButton: "Pagar",
    selectNftTitle: "Selecciona tu Golem",
    selectNftLoading: "Buscando tus Golems...",
    selectNftNone: "No tienes Golems válidos para este juego.",
    verifyTitle: "Verificación Requerida",
    verifySubtitle: "Verifica tu humanidad para reclamar tus bonos de bienvenida.",
    verifyButton: "Verificar con World ID",
    bonusTitle: "Bonos de Bienvenida",
    bonusSubtitle: "Reclama tus recompensas iniciales para empezar a jugar.",
    claimNftButton: "Reclamar NFT Gratis",
    claimGocButton: "Reclamar 10 GOC Gratis",
    claimed: "Reclamado",
    feedbackError: "Ocurrió un error.",
    feedbackAttacking: "Ejecutando ataque...",
    feedbackAttackSuccess: "¡Base capturada!",
    feedbackAttackFailed: "El ataque falló. Intenta de nuevo.",
    feedbackClaiming: "Reclamando...",
    feedbackClaimSuccess: "¡Reclamado con éxito!",
  },
  // ...otras traducciones...
};

type Language = keyof typeof translations;

// --- COMPONENTES AUXILIARES ---

const AuthButton = ({ children, className, onConnectSuccess, ...props }: any) => {
  const [isPending, setIsPending] = useState(false);
  const { isInstalled } = useMiniKit();
  const onClick = useCallback(async () => {
    if (!isInstalled() || isPending) return;
    setIsPending(true);
    try { await walletAuth(onConnectSuccess); }
    catch (error) { console.error('Auth error', error); }
    finally { setIsPending(false); }
  }, [isInstalled, isPending, onConnectSuccess]);
  return <Button onClick={onClick} disabled={isPending || !isInstalled()} className={clsx("w-full", className)} {...props}>{children || (isPending ? 'Iniciando...' : 'Iniciar Sesión con World App')}</Button>;
};

const Page = ({ children }: { children: React.ReactNode }) => <div className="w-full h-full">{children}</div>;
Page.Header = ({ children, className }: { children: React.ReactNode, className?: string }) => <header className={className}>{children}</header>;
Page.Main = ({ children, className }: { children: React.ReactNode, className?: string }) => <main className={className}>{children}</main>;

const PurchaseCubeModal = ({ isOpen, onClose, t }: { isOpen: boolean, onClose: () => void, t: any }) => {
  const { data: session } = useSession();
  const userWallet = session?.user?.walletAddress;
  const [selectedCubeId, setSelectedCubeId] = useState('comun');
  const [selectedCurrencyId, setSelectedCurrencyId] = useState(Tokens.WLD);
  const [flowState, setFlowState] = useState<'idle' | 'pending_payment' | 'verifying' | 'success' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  type CubeOption = { id: string; name: string; icon: string; prices: { [key in Tokens]?: number } };
  const CUBE_OPTIONS: CubeOption[] = [
    { id: 'comun', name: 'Común', icon: 'https://placehold.co/100x100/808080/FFFFFF?text=C', prices: { [Tokens.WLD]: 1, [Tokens.USDC]: 1 } },
    { id: 'raro', name: 'Raro', icon: 'https://placehold.co/100x100/0000FF/FFFFFF?text=R', prices: { [Tokens.WLD]: 2, [Tokens.USDC]: 2 } },
    { id: 'mitico', name: 'Mítico', icon: 'https://placehold.co/100x100/800080/FFFFFF?text=M', prices: { [Tokens.WLD]: 5, [Tokens.USDC]: 5 } },
  ];
  const CURRENCY_OPTIONS = [
    { id: Tokens.WLD, name: 'Worldcoin', icon: 'https://placehold.co/24x24/000000/FFFFFF?text=W' },
    { id: Tokens.USDC, name: 'USDC', icon: 'https://placehold.co/24x24/2775CA/FFFFFF?text=U' },
  ];

  if (!isOpen) return null;

  const selectedCube = CUBE_OPTIONS.find(c => c.id === selectedCubeId)!;
  const price = selectedCube.prices[selectedCurrencyId] ?? 0;

  const handlePurchase = async () => {
    if (!userWallet) return;
    const toAddress = '0x4a789d9757a9c3bbfa7e271cf5039d508cd6f2e3'; // DIRECCIÓN DE TU CONTRATO O WALLET RECEPTORA
    setErrorMessage('');
    try {
      setFlowState('pending_payment');
      const paymentResult = await MiniKit.commandsAsync.pay({ to: toAddress, tokens: [{ symbol: selectedCurrencyId, token_amount: tokenToDecimals(price, selectedCurrencyId).toString() }], description: `Compra de Cubo ${selectedCube.name}` });
      if (paymentResult.finalPayload.status !== 'success' || !paymentResult.finalPayload.transaction_hash) throw new Error('El pago falló o fue cancelado.');
      
      setFlowState('verifying');
      const mintResponse = await fetch('/api/purchase-and-mint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userAddress: userWallet, txHash: paymentResult.finalPayload.transaction_hash, cubeType: selectedCubeId }) });
      const mintData = await mintResponse.json();
      if (!mintResponse.ok) throw new Error(mintData.error || 'El servidor no pudo crear el NFT.');
      
      setFlowState('success');
      setTimeout(() => { onClose(); setFlowState('idle'); }, 3000);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setFlowState('failed');
    }
  };

  const isPurchaseDisabled = flowState !== 'idle';
  let feedbackState: 'pending' | 'success' | 'failed' | undefined;
  if (flowState === 'pending_payment' || flowState === 'verifying') feedbackState = 'pending';
  else if (flowState === 'success') feedbackState = 'success';
  else if (flowState === 'failed') feedbackState = 'failed';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="relative bg-gray-900 border border-yellow-400/50 rounded-2xl w-full max-w-md p-6 text-white shadow-2xl">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-white"><Xmark /></button>
        <h2 className="text-2xl font-bold text-center mb-6 text-yellow-400">{t.shopTitle}</h2>
        {/* ... resto del JSX del modal de compra ... */}
      </div>
    </div>
  );
};

const SelectNftModal = ({ onSelect, onClose, t }: { onSelect: (nftId: number) => void, onClose: () => void, t: any }) => {
  const { data: session } = useSession();
  const [userNfts, setUserNfts] = useState<{ id: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const nftContractAddress = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as `0x${string}`;

  const isNftValidForGame = (rarity: string, modelId: number): boolean => {
    if (rarity === "Común") return modelId >= 11 && modelId <= 20;
    const otherValidRareties = ["Poco Común", "Raro", "Épico", "Legendario", "Mítico"];
    if (otherValidRareties.includes(rarity)) return modelId >= 6 && modelId <= 10;
    return false;
  };

  useEffect(() => {
    const fetchNfts = async () => {
      if (!session?.user?.walletAddress || !nftContractAddress) return;
      setIsLoading(true);
      try {
        const publicClient = createPublicClient({ chain: worldchain, transport: http() });
        const balance = await publicClient.readContract({ address: nftContractAddress, abi: MiningNftABI.abi, functionName: 'balanceOf', args: [session.user.walletAddress] }) as bigint;
        
        const tokenIds: bigint[] = [];
        for (let i = 0; i < Number(balance); i++) {
          const tokenId = await publicClient.readContract({ address: nftContractAddress, abi: MiningNftABI.abi, functionName: 'tokenOfOwnerByIndex', args: [session.user.walletAddress, i] });
          tokenIds.push(tokenId as bigint);
        }

        const validNfts: { id: number }[] = [];
        for (const tokenId of tokenIds) {
          try {
            const tokenUri = await publicClient.readContract({ address: nftContractAddress, abi: MiningNftABI.abi, functionName: 'tokenURI', args: [tokenId] }) as string;
            const metadataUrl = tokenUri.replace('ipfs://', 'https://ipfs.io/ipfs/');
            const metadataResponse = await fetch(metadataUrl);
            const metadata = await metadataResponse.json();
            
            const rarityAttr = metadata.attributes?.find((attr: any) => attr.trait_type === 'Rareza');
            const modelAttr = metadata.attributes?.find((attr: any) => attr.trait_type === 'Modelo');
            const modelId = modelAttr ? parseInt(modelAttr.value.replace('Modelo ', ''), 10) : 0;
            const rarity = rarityAttr?.value || "Común";
            
            if (isNftValidForGame(rarity, modelId)) {
              validNfts.push({ id: Number(tokenId) });
            }
          } catch (e) { console.warn(`No se pudo leer la metadata para el token ID ${tokenId}:`, e); }
        }
        setUserNfts(validNfts);

      } catch (error) { console.error("Error al obtener NFTs:", error); }
      finally { setIsLoading(false); }
    };
    fetchNfts();
  }, [session, nftContractAddress]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-slate-700 rounded-lg shadow-2xl p-6 w-full max-w-sm text-center relative">
        <button onClick={onClose} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white"><Xmark /></button>
        <h2 className="text-2xl text-white mb-4">{t.selectNftTitle}</h2>
        {/* ... resto del JSX del modal de selección de NFT ... */}
      </div>
    </div>
  );
};

const Verify = ({ onSuccess, t }: { onSuccess: () => void, t: any }) => {
  const { data: session } = useSession();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const handleVerificationClick = async () => {
    setIsVerifying(true);
    setVerificationError(null);
    try {
      const { finalPayload } = await MiniKit.commandsAsync.verify({
        action: 'claim-welcome-bonus',
        signal: session?.user?.walletAddress,
        verification_level: VerificationLevel.Orb,
      });
      if (finalPayload.status !== 'success') throw new Error(finalPayload.error_code ?? 'Verificación cancelada.');
      
      const verifyResponse = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: finalPayload as ISuccessResult }) });
      if (!verifyResponse.ok) throw new Error('La verificación en el servidor falló.');
      
      onSuccess();
    } catch (err: any) {
      setVerificationError(err.message || "Ocurrió un error inesperado.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center text-center">
      <p className="mb-4 text-slate-400">{t.verifySubtitle}</p>
      <Button onClick={handleVerificationClick} disabled={isVerifying} variant="primary" className="!bg-blue-600 hover:!bg-blue-700">
        <ShieldCheck className="inline mr-2" />
        {isVerifying ? 'Verificando...' : t.verifyButton}
      </Button>
      <div className="h-10 mt-2 text-sm">
        {verificationError && <p className="text-red-400">{verificationError}</p>}
      </div>
    </div>
  );
};
// --- PÁGINA PRINCIPAL DEL JUEGO ---
const MiningBasePage = () => {
  const { data: session, update } = useSession();
  const [language, setLanguage] = useState<Language>('es');
  const t = useMemo(() => translations[language], [language]);

  // Game State
  const [minerInfo, setMinerInfo] = useState<{ address: string; nftId: number } | null>(null);
  const [accumulatedReward, setAccumulatedReward] = useState("0.00");
  const [isLoading, setIsLoading] = useState(true);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isSelectNftOpen, setIsSelectNftOpen] = useState(false);
  const [attackState, setAttackState] = useState<'idle' | 'attacking' | 'cooldown'>('idle');
  const [cooldownTime, setCooldownTime] = useState(0);
  const [feedback, setFeedback] = useState<{ state?: 'pending' | 'success' | 'failed', message: string }>({});

  // User State
  const [isVerified, setIsVerified] = useState(false);
  const [claimedNft, setClaimedNft] = useState(false);
  const [claimedGoc, setClaimedGoc] = useState(false);
  const [claimState, setClaimState] = useState<'idle' | 'pending'>('idle');

  // Fetch initial game state
  const fetchGameData = useCallback(async () => {
    if (!session?.user?.walletAddress) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/game-state?user=${session.user.walletAddress}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch game state');
      
      setMinerInfo(data.minerInfo);
      setAccumulatedReward(data.accumulatedReward);
      setIsVerified(data.userProfile.isVerified);
      setClaimedNft(data.userProfile.claimedBonuses.nft);
      setClaimedGoc(data.userProfile.claimedBonuses.goc);
      
      const now = Date.now();
      if (data.userProfile.cooldownEnds > now) {
        setAttackState('cooldown');
        setCooldownTime(Math.round((data.userProfile.cooldownEnds - now) / 1000));
      } else {
        setAttackState('idle');
        setCooldownTime(0);
      }

    } catch (error) {
      console.error("Error fetching game data:", error);
      setFeedback({ state: 'failed', message: t.feedbackError });
    } finally {
      setIsLoading(false);
    }
  }, [session, t.feedbackError]);

  useEffect(() => {
    fetchGameData();
    // Refrescar datos cada 30 segundos
    const interval = setInterval(fetchGameData, 30000);
    return () => clearInterval(interval);
  }, [fetchGameData]);

  // Cooldown timer effect
  useEffect(() => {
    if (attackState !== 'cooldown' || cooldownTime <= 0) return;
    const timer = setInterval(() => {
      setCooldownTime(prev => {
        if (prev <= 1) {
          setAttackState('idle');
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [attackState, cooldownTime]);

  const handleAttack = async (nftId: number) => {
    if (!session?.user?.walletAddress) return;
    setAttackState('attacking');
    setFeedback({ state: 'pending', message: t.feedbackAttacking });
    try {
      const response = await fetch('/api/attack', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: session.user.walletAddress, nftId }) 
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setFeedback({ state: 'success', message: t.feedbackAttackSuccess });
      await fetchGameData(); // Refresh game state immediately

    } catch (error) {
      console.error("Attack failed:", error);
      setFeedback({ state: 'failed', message: (error as Error).message });
      setAttackState('idle'); // Reset state on failure
    }
  };

  const handleSelectNftAndAttack = (nftId: number) => {
    setIsSelectNftOpen(false);
    handleAttack(nftId);
  };

  const handleVerificationSuccess = async () => {
    await update({ ...session, user: { ...session?.user, isVerified: true } });
    setIsVerified(true);
    await fetchGameData(); // Refresh data to show bonus screen
  };

  const handleClaim = async (type: 'nft' | 'goc') => {
    if (!session?.user?.walletAddress) return;
    setClaimState('pending');
    setFeedback({ state: 'pending', message: t.feedbackClaiming });
    try {
        const response = await fetch(`/api/claim-${type}`, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAddress: session.user.walletAddress })
        });
        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'Claim failed');
        }

        setFeedback({ state: 'success', message: t.feedbackClaimSuccess });
        await fetchGameData(); // Refresh data

    } catch (error) {
        setFeedback({ state: 'failed', message: (error as Error).message });
    } finally {
        setClaimState('idle');
    }
  };

  const renderContent = () => {
    // ... toda la lógica de renderizado ...
  };

  if (!session) {
    // ... JSX para el estado de no autenticado ...
  }

  return (
    <Page>
      <TopBar
        title={t.pageTitle}
        subtext={t.pageSubtitle}
        onSignOut={() => signOut()}
        // ... resto del JSX de TopBar ...
      />
      {renderContent()}
      <PurchaseCubeModal isOpen={isShopOpen} onClose={() => setIsShopOpen(false)} t={t} />
      <SelectNftModal isOpen={isSelectNftOpen} onClose={() => setIsSelectNftOpen(false)} onSelect={handleSelectNftAndAttack} t={t} />
    </Page>
  );
};

// --- COMPONENTE WRAPPER PRINCIPAL ---
export default function App() {
  return (
    <SessionProvider>
      <MiniKit
          action="king-of-the-base-game"
          signal={null}
          verification_level={VerificationLevel.Orb}
          enable_telemetry
      >
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            <MiningBasePage />
        </div>
      </MiniKit>
    </SessionProvider>
  );
 }
