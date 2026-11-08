//! LiteSVM tests against the real compiled program (target/deploy/kerb.so). Run: cargo build-sbf && cargo test.

use anchor_lang::{
    prelude::Pubkey,
    solana_program::{instruction::Instruction, program_pack::Pack, system_program},
    AccountDeserialize, InstructionData, ToAccountMetas,
};
use anchor_spl::{associated_token::get_associated_token_address_with_program_id as ata, token::spl_token};
use kerb::{Config, Offer, CONFIG_SEED, OFFER_SEED};
use litesvm::LiteSVM;
use solana_account::Account;
use solana_clock::Clock;
use solana_keypair::Keypair;
use solana_signer::Signer;
use solana_transaction::Transaction;

const SOL: u64 = 1_000_000_000;
const DAY: i64 = 86_400;
const ATA_PROGRAM: Pubkey = anchor_spl::associated_token::ID;

struct Env {
    svm: LiteSVM,
    admin: Keypair,
    maker: Keypair,
    taker: Keypair,
    other: Keypair,
    treasury: Pubkey,
    mint: Pubkey,
    config: Pubkey,
}

fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &kerb::ID).0
}
fn offer_pda(id: u64) -> Pubkey {
    pda(&[OFFER_SEED, &id.to_le_bytes()])
}
fn tok(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    ata(owner, mint, &spl_token::ID)
}

impl Env {
    fn new() -> Self {
        let mut svm = LiteSVM::new();
        svm.add_program_from_file(kerb::ID, "../../target/deploy/kerb.so").unwrap();
        let (admin, maker, taker, other) = (Keypair::new(), Keypair::new(), Keypair::new(), Keypair::new());
        for k in [&admin, &maker, &taker, &other] {
            svm.airdrop(&k.pubkey(), 100 * SOL).unwrap();
        }
        let treasury = Pubkey::new_unique();
        svm.airdrop(&treasury, SOL).unwrap();
        let mint = Pubkey::new_unique();
        let mut data = vec![0u8; spl_token::state::Mint::LEN];
        spl_token::state::Mint { mint_authority: Some(admin.pubkey()).into(), supply: 0, decimals: 6, is_initialized: true, freeze_authority: None.into() }
            .pack_into_slice(&mut data);
        svm.set_account(mint, Account { lamports: SOL, data, owner: spl_token::ID, executable: false, rent_epoch: 0 }).unwrap();
        let config = pda(&[CONFIG_SEED]);
        let mut e = Env { svm, admin, maker, taker, other, treasury, mint, config };
        for k in [e.maker.pubkey(), e.taker.pubkey(), e.other.pubkey()] {
            e.put_tokens(k, 1_000_000);
        }
        let ix = Instruction {
            program_id: kerb::ID,
            accounts: kerb::accounts::Initialize { admin: e.admin.pubkey(), config, system_program: system_program::ID }.to_account_metas(None),
            data: kerb::instruction::Initialize { treasury }.data(),
        };
        let admin = e.admin.insecure_clone();
        e.send(&[ix], &[&admin]).unwrap();
        e
    }

    fn put_tokens(&mut self, owner: Pubkey, amount: u64) {
        let mut data = vec![0u8; spl_token::state::Account::LEN];
        spl_token::state::Account {
            mint: self.mint,
            owner,
            amount,
            delegate: None.into(),
            state: spl_token::state::AccountState::Initialized,
            is_native: None.into(),
            delegated_amount: 0,
            close_authority: None.into(),
        }
        .pack_into_slice(&mut data);
        self.svm
            .set_account(tok(&owner, &self.mint), Account { lamports: 2_039_280, data, owner: spl_token::ID, executable: false, rent_epoch: 0 })
            .unwrap();
    }

    fn send(&mut self, ixs: &[Instruction], signers: &[&Keypair]) -> Result<(), String> {
        self.svm.expire_blockhash();
        let tx = Transaction::new_signed_with_payer(ixs, Some(&signers[0].pubkey()), signers, self.svm.latest_blockhash());
        self.svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{:?} {:?}", e.err, e.meta.logs))
    }

    fn now(&self) -> i64 {
        self.svm.get_sysvar::<Clock>().unix_timestamp
    }
    fn warp(&mut self, secs: i64) {
        let mut c = self.svm.get_sysvar::<Clock>();
        c.unix_timestamp += secs;
        c.slot += 1;
        self.svm.set_sysvar(&c);
    }
    fn lamports(&self, a: &Pubkey) -> u64 {
        self.svm.get_account(a).map(|a| a.lamports).unwrap_or(0)
    }
    fn tokens(&self, owner: &Pubkey) -> u64 {
        self.svm.get_account(&tok(owner, &self.mint)).map(|a| spl_token::state::Account::unpack(&a.data).unwrap().amount).unwrap_or(0)
    }
    fn config(&self) -> Config {
        Config::try_deserialize(&mut &self.svm.get_account(&self.config).unwrap().data[..]).unwrap()
    }
    fn offer(&self, id: u64) -> Offer {
        Offer::try_deserialize(&mut &self.svm.get_account(&offer_pda(id)).unwrap().data[..]).unwrap()
    }
    fn next_id(&self) -> u64 {
        self.config().offer_count
    }

    fn post_ask(&mut self, maker: &Keypair, amount: u64, total: u64, min_fill: u64, taker: Pubkey, expiry: i64) -> Result<u64, String> {
        let id = self.next_id();
        let offer = offer_pda(id);
        let ix = Instruction {
            program_id: kerb::ID,
            accounts: kerb::accounts::PostAsk {
                maker: maker.pubkey(),
                config: self.config,
                offer,
                mint: self.mint,
                maker_tokens: tok(&maker.pubkey(), &self.mint),
                vault: tok(&offer, &self.mint),
                token_program: spl_token::ID,
                associated_token_program: ATA_PROGRAM,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
            data: kerb::instruction::PostAsk { amount, total, min_fill, taker, expiry }.data(),
        };
        self.send(&[ix], &[maker]).map(|_| id)
    }

    fn post_bid(&mut self, maker: &Keypair, amount: u64, total: u64, min_fill: u64, taker: Pubkey, expiry: i64) -> Result<u64, String> {
        let id = self.next_id();
        let ix = Instruction {
            program_id: kerb::ID,
            accounts: kerb::accounts::PostBid { maker: maker.pubkey(), config: self.config, offer: offer_pda(id), mint: self.mint, system_program: system_program::ID }
                .to_account_metas(None),
            data: kerb::instruction::PostBid { amount, total, min_fill, taker, expiry }.data(),
        };
        self.send(&[ix], &[maker]).map(|_| id)
    }

    fn take_ask(&mut self, taker: &Keypair, id: u64, tokens: u64) -> Result<(), String> {
        let o = self.offer(id);
        let offer = offer_pda(id);
        let ix = Instruction {
            program_id: kerb::ID,
            accounts: kerb::accounts::TakeAsk {
                taker: taker.pubkey(),
                config: self.config,
                offer,
                maker: o.maker,
                treasury: self.treasury,
                mint: self.mint,
                vault: tok(&offer, &self.mint),
                taker_tokens: tok(&taker.pubkey(), &self.mint),
                token_program: spl_token::ID,
                associated_token_program: ATA_PROGRAM,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
            data: kerb::instruction::TakeAsk { tokens }.data(),
        };
        self.send(&[ix], &[taker])
    }

    fn take_bid(&mut self, taker: &Keypair, id: u64, tokens: u64) -> Result<(), String> {
        let o = self.offer(id);
        let ix = Instruction {
            program_id: kerb::ID,
            accounts: kerb::accounts::TakeBid {
                taker: taker.pubkey(),
                config: self.config,
                offer: offer_pda(id),
                maker: o.maker,
                treasury: self.treasury,
                mint: self.mint,
                taker_tokens: tok(&taker.pubkey(), &self.mint),
                maker_tokens: tok(&o.maker, &self.mint),
                token_program: spl_token::ID,
                associated_token_program: ATA_PROGRAM,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
            data: kerb::instruction::TakeBid { tokens }.data(),
        };
        self.send(&[ix], &[taker])
    }

    fn close_ask(&mut self, signer: &Keypair, id: u64) -> Result<(), String> {
        let o = self.offer(id);
        let offer = offer_pda(id);
        let ix = Instruction {
            program_id: kerb::ID,
            accounts: kerb::accounts::CloseAsk {
                signer: signer.pubkey(),
                offer,
                maker: o.maker,
                mint: self.mint,
                vault: tok(&offer, &self.mint),
                maker_tokens: tok(&o.maker, &self.mint),
                token_program: spl_token::ID,
                associated_token_program: ATA_PROGRAM,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
            data: kerb::instruction::CloseAsk {}.data(),
        };
        self.send(&[ix], &[signer])
    }

    fn close_bid(&mut self, signer: &Keypair, id: u64) -> Result<(), String> {
        let o = self.offer(id);
        let ix = Instruction {
            program_id: kerb::ID,
            accounts: kerb::accounts::CloseBid { signer: signer.pubkey(), offer: offer_pda(id), maker: o.maker }.to_account_metas(None),
            data: kerb::instruction::CloseBid {}.data(),
        };
        self.send(&[ix], &[signer])
    }
}

fn any() -> Pubkey {
    Pubkey::default()
}

#[test]
fn ask_whole_bag_one_transaction() {
    let mut e = Env::new();
    let (maker, taker) = (e.maker.insecure_clone(), e.taker.insecure_clone());
    let exp = e.now() + DAY;
    let id = e.post_ask(&maker, 400_000, 2 * SOL, 400_000, any(), exp).unwrap();
    assert_eq!(e.tokens(&maker.pubkey()), 600_000);
    assert_eq!(e.tokens(&offer_pda(id)), 400_000);

    let (m0, t0, tr0) = (e.lamports(&maker.pubkey()), e.lamports(&taker.pubkey()), e.lamports(&e.treasury));
    e.take_ask(&taker, id, 400_000).unwrap();
    assert_eq!(e.tokens(&taker.pubkey()), 1_400_000);
    assert_eq!(e.lamports(&maker.pubkey()) - m0, 2 * SOL);
    assert_eq!(e.lamports(&e.treasury) - tr0, 2 * SOL * 30 / 10_000);
    assert!(t0 - e.lamports(&taker.pubkey()) >= 2 * SOL + 6_000_000);
    let o = e.offer(id);
    assert!(!o.open);
    assert_eq!(o.filled, 400_000);
    let c = e.config();
    assert_eq!((c.fills, c.volume), (1, 2 * SOL));
    // Nothing more can be taken.
    assert!(e.take_ask(&taker, id, 1).is_err());
}

#[test]
fn ask_taker_without_token_account_gets_one() {
    let mut e = Env::new();
    let maker = e.maker.insecure_clone();
    let fresh = Keypair::new();
    e.svm.airdrop(&fresh.pubkey(), 10 * SOL).unwrap();
    let exp = e.now() + DAY;
    let id = e.post_ask(&maker, 1_000, SOL, 1_000, any(), exp).unwrap();
    e.take_ask(&fresh, id, 1_000).unwrap();
    assert_eq!(e.tokens(&fresh.pubkey()), 1_000);
}

#[test]
fn partial_fills_add_up_to_the_exact_total() {
    let mut e = Env::new();
    let (maker, taker, other) = (e.maker.insecure_clone(), e.taker.insecure_clone(), e.other.insecure_clone());
    let exp = e.now() + DAY;
    let total = 1_000_000_007; // not a multiple of the amount: rounding must still add up
    let id = e.post_ask(&maker, 300, total, 100, any(), exp).unwrap();
    let m0 = e.lamports(&maker.pubkey());
    // Below the smallest fill: refused.
    assert!(e.take_ask(&taker, id, 99).is_err());
    // Would leave 50, below the smallest fill: refused.
    assert!(e.take_ask(&taker, id, 250).is_err());
    e.take_ask(&taker, id, 100).unwrap();
    e.take_ask(&other, id, 100).unwrap();
    e.take_ask(&taker, id, 100).unwrap();
    assert_eq!(e.lamports(&maker.pubkey()) - m0, total);
    assert!(!e.offer(id).open);
    assert_eq!(e.config().fills, 3);
}

#[test]
fn private_offer_only_for_its_taker() {
    let mut e = Env::new();
    let (maker, taker, other) = (e.maker.insecure_clone(), e.taker.insecure_clone(), e.other.insecure_clone());
    let exp = e.now() + DAY;
    let id = e.post_ask(&maker, 500, SOL, 500, taker.pubkey(), exp).unwrap();
    let err = e.take_ask(&other, id, 500).unwrap_err();
    assert!(err.contains("NotTaker"), "{err}");
    e.take_ask(&taker, id, 500).unwrap();
}

#[test]
fn bad_terms_are_refused() {
    let mut e = Env::new();
    let maker = e.maker.insecure_clone();
    let now = e.now();
    assert!(e.post_ask(&maker, 0, SOL, 1, any(), now + DAY).unwrap_err().contains("ZeroAmount"));
    assert!(e.post_ask(&maker, 10, 0, 1, any(), now + DAY).unwrap_err().contains("ZeroAmount"));
    assert!(e.post_ask(&maker, 10, SOL, 11, any(), now + DAY).unwrap_err().contains("BadMinFill"));
    assert!(e.post_ask(&maker, 10, SOL, 0, any(), now + DAY).unwrap_err().contains("BadMinFill"));
    assert!(e.post_ask(&maker, 10, SOL, 10, any(), now).unwrap_err().contains("BadExpiry"));
    assert!(e.post_ask(&maker, 10, SOL, 10, any(), now + 31 * DAY).unwrap_err().contains("BadExpiry"));
    assert!(e.post_ask(&maker, 10, SOL, 10, maker.pubkey(), now + DAY).unwrap_err().contains("SelfFill"));
    assert!(e.post_bid(&maker, 10, SOL, 10, maker.pubkey(), now + DAY).unwrap_err().contains("SelfFill"));
}

#[test]
fn maker_cannot_fill_own_offer() {
    let mut e = Env::new();
    let maker = e.maker.insecure_clone();
    let exp = e.now() + DAY;
    let id = e.post_ask(&maker, 500, SOL, 500, any(), exp).unwrap();
    assert!(e.take_ask(&maker, id, 500).unwrap_err().contains("SelfFill"));
}

#[test]
fn expired_offer_cannot_be_taken_and_comes_back_to_maker() {
    let mut e = Env::new();
    let (maker, taker, other) = (e.maker.insecure_clone(), e.taker.insecure_clone(), e.other.insecure_clone());
    let exp = e.now() + DAY;
    let id = e.post_ask(&maker, 500, SOL, 100, any(), exp).unwrap();
    e.take_ask(&taker, id, 200).unwrap();
    // A stranger cannot close it before expiry.
    assert!(e.close_ask(&other, id).unwrap_err().contains("NotExpired"));
    e.warp(DAY);
    assert!(e.take_ask(&taker, id, 300).unwrap_err().contains("Expired"));
    // After expiry anyone can send the escrow back, only to the maker.
    let before = e.tokens(&maker.pubkey());
    e.close_ask(&other, id).unwrap();
    assert_eq!(e.tokens(&maker.pubkey()) - before, 300);
    assert!(e.svm.get_account(&tok(&offer_pda(id), &e.mint)).map(|a| a.lamports == 0).unwrap_or(true));
    assert!(e.close_ask(&maker, id).is_err());
}

#[test]
fn maker_cancels_any_time() {
    let mut e = Env::new();
    let maker = e.maker.insecure_clone();
    let exp = e.now() + DAY;
    let id = e.post_ask(&maker, 700, SOL, 700, any(), exp).unwrap();
    let (t0, l0) = (e.tokens(&maker.pubkey()), e.lamports(&maker.pubkey()));
    e.close_ask(&maker, id).unwrap();
    assert_eq!(e.tokens(&maker.pubkey()) - t0, 700);
    // Vault rent comes back as well.
    assert!(e.lamports(&maker.pubkey()) > l0);
    assert!(!e.offer(id).open);
}

#[test]
fn bid_holder_sells_straight_to_maker() {
    let mut e = Env::new();
    let (maker, taker) = (e.maker.insecure_clone(), e.taker.insecure_clone());
    let exp = e.now() + DAY;
    let id = e.post_bid(&maker, 1_000, 3 * SOL, 500, any(), exp).unwrap();
    let held = e.lamports(&offer_pda(id));
    assert!(held >= 3 * SOL);

    let (m0, t0, tr0) = (e.tokens(&maker.pubkey()), e.lamports(&taker.pubkey()), e.lamports(&e.treasury));
    e.take_bid(&taker, id, 500).unwrap();
    let sol = 3 * SOL / 2;
    let fee = sol * 30 / 10_000;
    assert_eq!(e.tokens(&maker.pubkey()) - m0, 500);
    assert_eq!(e.lamports(&e.treasury) - tr0, fee);
    assert!(e.lamports(&taker.pubkey()) + 10_000 >= t0 + sol - fee);
    assert!(e.offer(id).open);

    // The maker takes the rest of the bid back.
    let l0 = e.lamports(&maker.pubkey());
    e.close_bid(&maker, id).unwrap();
    assert!(e.lamports(&maker.pubkey()) + 10_000 >= l0 + 3 * SOL - sol);
    assert!(e.close_bid(&maker, id).is_err());
    assert!(e.take_bid(&taker, id, 500).is_err());
}

#[test]
fn bid_to_a_maker_without_token_account() {
    let mut e = Env::new();
    let taker = e.taker.insecure_clone();
    let fresh = Keypair::new();
    e.svm.airdrop(&fresh.pubkey(), 10 * SOL).unwrap();
    let exp = e.now() + DAY;
    let id = e.post_bid(&fresh, 100, SOL, 100, any(), exp).unwrap();
    e.take_bid(&taker, id, 100).unwrap();
    assert_eq!(e.tokens(&fresh.pubkey()), 100);
    assert!(!e.offer(id).open);
}

#[test]
fn only_admin_sets_treasury_and_fees_go_there() {
    let mut e = Env::new();
    let (admin, other, maker, taker) = (e.admin.insecure_clone(), e.other.insecure_clone(), e.maker.insecure_clone(), e.taker.insecure_clone());
    let new_t = Pubkey::new_unique();
    let ix = |who: &Keypair| Instruction {
        program_id: kerb::ID,
        accounts: kerb::accounts::Admin { admin: who.pubkey(), config: pda(&[CONFIG_SEED]) }.to_account_metas(None),
        data: kerb::instruction::SetTreasury { treasury: new_t }.data(),
    };
    assert!(e.send(&[ix(&other)], &[&other]).unwrap_err().contains("NotAdmin"));
    e.send(&[ix(&admin)], &[&admin]).unwrap();
    e.svm.airdrop(&new_t, SOL).unwrap();
    // The old treasury is refused.
    let exp = e.now() + DAY;
    let id = e.post_ask(&maker, 10, SOL, 10, any(), exp).unwrap();
    assert!(e.take_ask(&taker, id, 10).unwrap_err().contains("BadTreasury"));
    e.treasury = new_t;
    e.take_ask(&taker, id, 10).unwrap();
    assert_eq!(e.lamports(&new_t), SOL + SOL * 30 / 10_000);
}
