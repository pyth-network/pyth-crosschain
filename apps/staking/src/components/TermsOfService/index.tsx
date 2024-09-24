import clsx from "clsx";
import type { ReactNode, HTMLProps, ComponentProps } from "react";

import { Link as BaseLink } from "../Link";

export const TermsOfService = () => (
  <main className="mx-auto flex max-w-prose flex-col gap-10 py-6 md:gap-16 md:py-20">
    <div>
      <h1 className="text-3xl font-light md:text-4xl">Terms of Service</h1>
      <h2 className="text-sm opacity-60">Last updated: September 2024</h2>
    </div>
    <dl className="flex list-inside list-[upper-alpha] flex-col gap-10 md:gap-16">
      <Section title="Scope">
        <Paragraph>
          These Terms of Service (“<strong>Terms</strong>”) govern your access
          to and use of the website located at{" "}
          <Link href="/">https://staking.pyth.network</Link> (“
          <strong>Site</strong>”) operated by Pyth Data Association,
          Grabenstrasse 25, 6340 Baar, Switzerland (“
          <strong>Association</strong>
          ”, “<strong>we</strong>”, “<strong>us</strong>”, or “
          <strong>our</strong>”) and the use of our tools available therein (the
          “<strong>Tools</strong>” and together with the Site, “
          <strong>Services</strong>”).
        </Paragraph>
        <Paragraph>
          “<strong>You</strong>”, “<strong>your</strong>” and “
          <strong>User(s)</strong>” refers to anybody who accesses or in any way
          uses the Services. If you are accessing or in any way using the
          Services on behalf of a company (such as your employer) or other legal
          entity, you represent and warrant that you have the authority to bind
          that entity to these Terms and, in that case, “you”, “your” or
          “User(s)” will refer to that entity.
        </Paragraph>
        <div>
          <Paragraph>
            Please read the Terms carefully before you start accessing or in any
            way using the Services. By accessing or in any way using the
            Services or by clicking to accept or agree to these Terms when this
            option is made available to you, you accept and agree to be bound
            and abide by these Terms in addition to:
          </Paragraph>
          <UnorderedList>
            <li>
              our{" "}
              <Link
                href="https://pythdataassociation.com/terms-of-use"
                target="_blank"
              >
                Website Terms of Use
              </Link>
              , incorporated herein by reference; and
            </li>
            <li>
              our{" "}
              <Link
                href="https://pythdataassociation.com/privacy-policy"
                target="_blank"
              >
                Privacy Policy
              </Link>
              , incorporated herein by reference.
            </li>
          </UnorderedList>
        </div>

        <Paragraph>
          If you do not agree to these Terms, you are not permitted access or in
          any way use the Services. In the event of any conflict between these
          Terms, the{" "}
          <Link
            href="https://pythdataassociation.com/terms-of-use"
            target="_blank"
          >
            Website Terms of Use
          </Link>{" "}
          or the{" "}
          <Link
            href="https://pythdataassociation.com/privacy-policy"
            target="_blank"
          >
            Privacy Policy
          </Link>
          , the terms of these Terms shall control.
        </Paragraph>
      </Section>
      <Section title="External Content">
        <Paragraph>
          The Services provide links to third-party content (which may include
          smart contracts and cryptographically secured protocols). We provide
          such links only as a convenience and are not responsible for the
          content, products or services on or available from those resources or
          links displayed on such websites or items. USE OF ANY THIRD-PARTY
          PROTOCOL OR SMART CONTRACT LINKED ON THE SERVICES IS AT YOUR OWN RISK.
          THESE TERMS DO NOT GOVERN YOUR USE OF ANY PROTOCOL OR SMART CONTRACT
          OTHER THAN THE SERVICES. PLEASE CONSULT APPLICABLE LICENSES AND USER
          AGREEMENTS FOR INFORMATION REGARDING YOUR RIGHTS AND RISKS ASSOCIATED
          WITH YOUR USE OF AND ACCESS TO THESE MATERIALS.
        </Paragraph>
      </Section>
      <Section title="Acceptance of the Terms">
        <Paragraph>
          By accessing or in any way using the Services, you automatically agree
          to these Terms. Your access and use of the Services is conditioned on
          your acceptance of and/or compliance with these Terms, the{" "}
          <Link
            href="https://pythdataassociation.com/terms-of-use"
            target="_blank"
          >
            Website Terms of Use
          </Link>{" "}
          and our{" "}
          <Link
            href="https://pythdataassociation.com/privacy-policy"
            target="_blank"
          >
            Privacy Policy
          </Link>
          . These Terms shall exclusively apply; any of your terms and
          conditions that contradict or deviate from these Terms shall only be
          valid if and to the extent that we have expressly agreed to them. If
          you do not agree with any part of these Terms, you may not access or
          use the Services.
        </Paragraph>
      </Section>
      <Section title="Changes to these Terms">
        <Paragraph>
          These Terms may be changed at any time at our sole discretion and
          without prior notice. All changes are effective immediately upon
          posting. By continuing to use the Services after revised Terms have
          been posted, you signify your acceptance of and agreement to the
          changes.
        </Paragraph>
        <Paragraph>
          You are responsible to regularly review these Terms to stay informed
          of any updates, as they are legally binding on you.
        </Paragraph>
      </Section>
      <Section title="Accessing the Services">
        <Paragraph>
          We reserve the right to modify or discontinue the Services at our sole
          discretion and without prior notice. We do not guarantee continuous
          availability or uninterrupted access to the Services. We will not be
          liable if all or any part of the Services is unavailable at any time
          or for any duration.
        </Paragraph>
        <div>
          <Paragraph>You are responsible to:</Paragraph>
          <UnorderedList>
            <li>
              make all necessary arrangements to access and use the Services;
              and
            </li>
            <li>
              ensure that anyone who access or uses the Services through your
              internet connection is aware of and complies with these Terms.
            </li>
          </UnorderedList>
        </div>
      </Section>
      <Section title="Personal Restrictions">
        <Paragraph>
          The Services are only accessible to Users who are at least 18 years
          old. The Services are not meant for individuals under 18. By accessing
          or using the Services, you confirm and guarantee that you (i) are 18
          years old or older, (ii) are not prohibited from accessing or using
          the Services by any relevant laws. If you do not fulfill these
          criteria, you are not permitted to access or use the Services.
        </Paragraph>
      </Section>
      <Section title="Local Restrictions">
        <Paragraph>
          We are based in Switzerland and do not make any claims that the
          Services are accessible or appropriate outside of Switzerland.
          Accessing and/or using the Services may be illegal for certain
          individuals or in certain countries. If you choose to access and/or
          use the Services from outside Switzerland, you do so at your own risk
          and are responsible for complying with local laws.
        </Paragraph>
        <Paragraph>
          EXCEPT EXPLICTLY PROVIDED IN THESE TERMS, THE SERVICES ARE NOT
          DEVELOPED FOR, AND ARE NOT AVAILABLE TO PERSONS OR ENTITIES WHO RESIDE
          IN, ARE LOCATED IN, ARE INCORPORATED IN, OR HAVE A REGISTERED OFFICE
          OR PRINCIPAL PLACE OF BUSINESS IN THE UNITED STATES OF AMERICA OR THE
          UNITED KINGDOM (COLLECTIVELY, “<strong>BLOCKED PERSONS</strong>”).
          MOREOVER, THE SERVICES ARE NOT OFFERED TO PERSONS OR ENTITIES WHO
          RESIDE IN, ARE CITIZENS OF, ARE LOCATED IN, ARE INCORPORATED IN, OR
          HAVE A REGISTERED OFFICE OR PRINCIPAL PLACE OF BUSINESS IN ANY
          RESTRICTED JURISDICTION OR COUNTRY SUBJECT TO ANY SANCTIONS OR
          RESTRICTIONS PURSUANT TO ANY APPLICABLE LAW, INCLUDING THE CRIMEA
          REGION, CUBA, IRAN, NORTH KOREA, SYRIA, MYANMAR (BURMA, DONETSK,
          LUHANSK, OR ANY OTHER COUNTRY TO WHICH THE UNITED STATES, THE UNITED
          KINGDOM, THE EUROPEAN UNION, SWITZERLAND OR ANY OTHER JURISDICTIONS
          EMBARGOES GOODS OR IMPOSES SIMILAR SANCTIONS, INCLUDING THOSE LISTED
          ON OUR SERVICES (COLLECTIVELY, THE “
          <strong>RESTRICTED JURISDICTIONS</strong>” AND EACH A “
          <strong>RESTRICTED JURISDICTION</strong>”) OR ANY PERSON OWNED,
          CONTROLLED, LOCATED IN OR ORGANIZED UNDER THE LAWS OF ANY JURISDICTION
          UNDER EMBARGO OR CONNECTED OR AFFILIATED WITH ANY SUCH PERSON
          (COLLECTIVELY, “<strong>RESTRICTED PERSONS</strong>”). THE SERVICES
          WERE NOT SPECIFICALLY DEVELOPED FOR, AND IS NOT AIMED AT OR BEING
          ACTIVELY MARKETED TO, PERSONS OR ENTITIES WHO RESIDE IN, ARE LOCATED
          IN, ARE INCORPORATED IN, OR HAVE A REGISTERED OFFICE OR PRINCIPAL
          PLACE OF BUSINESS IN THE EUROPEAN UNION. THERE ARE NO EXCEPTIONS. IF
          YOU ARE A BLOCKED PERSON OR A RESTRICTED PERSON, THEN DO NOT USE OR
          ATTEMPT TO ACCESS AND/OR USE THE SERVICES. USE OF ANY TECHNOLOGY OR
          MECHANISM, SUCH AS A VIRTUAL PRIVATE NETWORK (“<strong>VPN</strong>”)
          TO CIRCUMVENT THE RESTRICTIONS SET FORTH HEREIN IS PROHIBITED.
        </Paragraph>
      </Section>
      <Section title="Services">
        <Paragraph>
          You access the Services by connecting a digital wallet holding digital
          assets to smart contract systems offered by third parties that
          communicate with the Services. You understand that we do not hold your
          digital assets, have no power of disposal over your digital assets, or
          take any custody of them. We have no access to your digital assets or
          funds.
        </Paragraph>
        <Paragraph>
          The Services allow you to participate in different non-custodial
          staking mechanisms on the Pyth Network (“<strong>Pyth Staking</strong>
          ”), an open-source oracle network (“<strong>Pyth Network</strong>”)
          governed by the Pyth DAO that provides financial market data to
          blockchain-based applications to provide high fidelity financial
          market data to the blockchain industry powered by a blockchain
          protocol on the Solana network (“<strong>Pyth Protocol</strong>”).
        </Paragraph>
        <Paragraph>
          For the avoidance of doubt, the Association does not control the Pyth
          Network and cannot control activity on the Pyth Network, including
          Pyth Staking, the activities of persons who develop and use
          applications on the Pyth Network, the production of data on the Pyth
          Network, or use of the Pyth Network. The Pyth Network is an
          open-source protocol that is governed by the Pyth DAO.
        </Paragraph>
        <Paragraph>
          We are not responsible for the keys to any digital assets or your seed
          phrase, or their loss or disclosure to others. The Association does
          not maintain your keys or your seed phrase, and is not responsible for
          their safe keeping. It is your responsibility at all times to ensure
          you have such credentials and maintain them securely. ANY LOSSES YOU
          SUFFER RELATING TO YOUR DIGITAL ASSET TRANSACTIONS, DIGITAL KEYS AND
          WALLETS, AND EXCHANGES ARE YOUR SOLE RESPONSIBILITY, AND YOU HEREBY
          INDEMNIFY US, AGREE TO DEFEND US, AND HOLD US HARMLESS AGAINST ANY
          CLAIMS OR LOSSES THAT YOU OR ANYONE ELSE SUFFERS AS A RESULT OF YOUR
          DIGITAL ASSET TRANSACTIONS, EVEN IF YOU INITIATED YOUR TRANSACTION BY
          ACCESSING OUR SERVICES. If, once you use the Services and participate
          in Pyth Staking, and your digital assets are somehow transferred to a
          third party you didn’t intend to have them, it is your responsibility
          to get them back. PLEASE KEEP YOUR SEED PHRASE AND DIGITAL KEYS SAFE,
          AS THE ASSOCIATION DOES NOT HAVE THEM AND DOES NOT KNOW THEM. IF YOU
          LOSE THE KEYS OR SEED PHRASE, YOU MAY LOSE ACCESS TO YOUR DIGITAL
          ASSETS.
        </Paragraph>
        <Paragraph>
          You also understand that we do not act as your transaction brokers,
          financial intermediary, or financial advisors or give you any advice
          of any kind with respect to what digital assets you choose to hold in
          your wallet or any staking thereof. As with Pyth Staking you can
          participate in via the Services, it is your responsibility and you are
          solely responsible for the contents of your digital wallet, your
          staking decisions, how and when you stake digital assets and with
          whom. It is also your responsibility to ensure you understand digital
          assets, how they work, what their value is, and about staking such
          digital assets, as there are significant risks in doing so, all of
          which you solely assume.
        </Paragraph>
        <Paragraph>
          Also note that the digital wallet you use for the Services may not
          connect or stake of all digital assets. It is your responsibility to
          ensure compatibility with the Pyth Network.
        </Paragraph>
        <Paragraph>
          We may suspend your access to or use of, or cancel your access to or
          use of the Services for any reason, including if we believe you have
          engaged in or are about to engage in any kind of fraud, if required
          pursuant to applicable laws, or you violate these Terms. We may
          provide you with notice of suspension, but do not undertake an
          obligation to do so. We may change the functionality of the Services
          at any time, which means some features could no longer be supported
          after a time. You acknowledge that this is the case, and accept this
          risk. Given that the digital wallets are non-custodial, we do not
          perform any activities to vet Users prior to allowing them to create
          their digital wallets or stake digital assets. You acknowledge that
          this is a risk you accept when you interact with the wallet or other
          users of the Services.
        </Paragraph>
        <Paragraph>
          Our Services may at times make mistakes. You accept the risk that your
          transactions may be improperly processed, or not processed at all. We
          will not be liable for any such event. You hereby hold us harmless
          from any such event. We offer no guarantees and shall not provide any
          refunds for any services you paid for staking digital assets, even if
          you lose such digital assets.
        </Paragraph>
      </Section>
      <Section title="General Prohibitions">
        <div>
          <Paragraph>You agree not to do any of the following:</Paragraph>
          <UnorderedList>
            <li>
              use the Services for the purpose of exploiting, harming, or
              attempting to exploit or harm minors in any way by exposing them
              to inappropriate content, asking for personally identifiable
              information, or otherwise;
            </li>
            <li>
              access, tamper with, or use non-public areas of the Services, our
              computer systems, or the technical delivery systems of our
              providers;{" "}
            </li>
            <li>
              attempt to probe, scan or test the vlinerability of any
              Association’s system or network or breach any security or
              authentication measures;{" "}
            </li>
            <li>
              avoid, bypass, remove, deactivate, impair, descramble or otherwise
              circumvent any technological measure implemented by us or any of
              our providers or any other third-party (including another User) to
              protect the Services;{" "}
            </li>
            <li>
              attempt to access or search the Services or download content from
              the Services using any engine, software, tool, agent, device or
              mechanism (including spiders, robots, crawlers, data mining tools
              or the like) other than the software and/or search agents provided
              by us or other generally available third-party web browsers;{" "}
            </li>
            <li>
              use any manual process to monitor the Services or for any other
              unauthorized purpose without our prior written consent;
            </li>
            <li>
              send any unsolicited or unauthorized advertising, promotional
              materials, email, junk mail, spam, chain letters or other form of
              solicitation;{" "}
            </li>
            <li>
              use any meta tags or other hidden text or metadata utilizing an
              Association’s trademark, logo URL or product name without our
              express written consent;{" "}
            </li>
            <li>
              use the Services, or any portion thereof, in any manner not
              permitted by these Terms;{" "}
            </li>
            <li>
              forge any TCP/IP packet header or any part of the header
              information in any email or newsgroup posting, or in any way use
              the Services to send altered, deceptive or false
              source-identifying information;{" "}
            </li>
            <li>
              attempt to decipher, decompile, disassemble or reverse engineer
              any of the software used to provide the Services;{" "}
            </li>
            <li>
              use, transmit, introduce or install any code, files, scripts,
              agents or programs intended to do harm or allow unauthorized
              access, including, for example, viruses, worms, time bombs, back
              doors and Trojan horses (collectively, “
              <strong>Malicious Code</strong>”) on or through the Services, or
              accessing or attempting to access the Services for the purpose of
              infiltrating a computer or computing system or network, or
              damaging the software components of the Services, or the systems
              of the hosting provider, any other suppliers or service provider
              involved in providing the Services, or another User;
            </li>
            <li>
              distribute Malicious Code or other items of a destructive or
              deceptive nature;
            </li>
            <li>
              interfere with, or attempt to interfere with, the access of any
              User, host or network, including, without limitation, sending a
              virus, overloading, flooding, spamming, mail-bombing the Services,
              or attacking the Services via a denial-of-service attack or a
              distributed denial-of-service attack;
            </li>
            <li>
              collect or store any personally identifiable information from the
              Services from other Users of the Services without their express
              permission;{" "}
            </li>
            <li>
              impersonate or attempt to impersonate the Association, an
              Association’s employee or representative, another User, or any
              other person or entity (including, without limitation, by using
              identifiers associated with any of the foregoing).;{" "}
            </li>
            <li>
              reverse look-up, track or seek to track any information of any
              other Users or visitors of the Services;{" "}
            </li>
            <li>
              take any actions that imposes an unreasonable or
              disproportionately large load on the infrastructure of systems or
              networks of the Services, or the infrastructure of any systems or
              networks connected to the Services;{" "}
            </li>
            <li>
              use the Services, directly or indirectly, for or in connection
              with money laundering, terrorist financing, or other illicit
              financial activity;
            </li>
            <li>
              use the Services for market manipliation, regardless of whether
              prohibited by law);
            </li>
            <li>
              use the Services to participate in fundraising for a business,
              protocol, or platform; or fabricate in any way any transaction or
              process related thereto;{" "}
            </li>
            <li>
              disguise or interfere in any way with the IP address of the
              computer you are using to access or use the Services or that
              otherwise prevents us from correctly identifying the IP address of
              the computer you are using to access the Services;{" "}
            </li>
            <li>
              engage in any other conduct that restricts or inhibits anyone’s
              use or enjoyment of the Services, or which, as determined by us,
              may harm the Association or Users of the Services or expose them
              to liability;
            </li>
            <li>use the Services in or from any Restricted Jurisdictions;</li>
            <li>
              use the Services if you if you are a Blocked or Restricted Person
              (or on their behalf);
            </li>
            <li>
              use the Services in any way that violates any applicable federal,
              state, local, or international law or regliation (including,
              without limitation, any laws regarding the export of data or
              software to and from the United States, Canada, European Union,
              Switzerland or other countries); or
            </li>
            <li>
              encourage or enable any other individual to do any of the
              foregoing.{" "}
            </li>
          </UnorderedList>
        </div>
        <Paragraph>
          The Association is not obligated to monitor access to or use of the
          Services or to review or edit any content. However, we reserve the
          right to do so in our discretion, if we choose. We reserve the right,
          but are not obligated, to remove or disable access to any content, at
          any time and without notice, including, but not limited to, if we, at
          our sole discretion, consider it objectionable or in violation of
          these Terms. We have the right to investigate violations of these
          Terms or conduct that affects the Services. We may also consult and
          cooperate with law enforcement authorities to prosecute users who
          violate the law.
        </Paragraph>
      </Section>
      <Section title="Intellectual Property and Trademarks">
        <Paragraph>
          The Services and their entire contents, features, and functionality
          (including but not limited to all information, software, text,
          displays, images, video, and audio, and the design, selection, and
          arrangement thereof), other than third-party content, are owned by the
          Association, its licensors, or other providers of such material and
          are protected by copyright, trademark, patent, trade secret, and other
          intellectual property or proprietary rights laws.
        </Paragraph>
        <Paragraph>
          Accessing or using the Services does not grant you any license or
          rights to use the intellectual property or trademarks of the
          Association, its licensors, its partners, or any third party, except
          as expressly permitted by these Terms. Any unauthorized use of such
          intellectual property may result in legal action.
        </Paragraph>
        <div>
          <Paragraph>
            You must not reproduce, distribute, modify, create derivative works
            of, publicly display, publicly perform, republish, download, store,
            or transmit any of the material on our Services, except as follows:
          </Paragraph>
          <UnorderedList>
            <li>
              your computer may temporarily store copies of such materials in
              RAM incidental to your accessing and viewing those materials;
            </li>
            <li>
              you may store files that are automatically cached by your web
              browser for display enhancement purposes; and/or
            </li>
            <li>
              you may print or download one copy of a reasonable number of pages
              of the Site for your own use and not for further reproduction,
              publication, or distribution.
            </li>
          </UnorderedList>
        </div>
        <div>
          <Paragraph>You must not:</Paragraph>
          <UnorderedList>
            <li>modify copies of any materials from the Services;</li>
            <li>
              use any illustrations, photographs, video or audio sequences, or
              any graphics separately from the accompanying text; and/or
            </li>
            <li>
              delete or alter any copyright, trademark, or other proprietary
              rights notices from copies of materials from the Services.
            </li>
          </UnorderedList>
        </div>
        <Paragraph>
          If you print, copy, modify, download, or otherwise use or provide any
          other person with access to any part of the Services in breach of the
          Terms, your right to access and/or use the Services will stop
          immediately and you must, at our option, return or destroy any copies
          of the materials you have made. No right, title, or interest in or to
          the Services or any content on the Services is transferred to you, and
          all rights not expressly granted are reserved by the Association. Any
          use of the Services not expressly permitted by these Terms is a breach
          of these Terms and may violate copyright, trademark, and other laws.
        </Paragraph>
        <Paragraph>
          The Association’s name, and all trademarks, logos, taglines, service
          names, designs, and slogans on the Services are trademarks of the
          Association or its affiliates or licensors. You must not use such
          marks without our prior written permission.
        </Paragraph>
      </Section>
      <Section title="Taxes and Fraud">
        <Paragraph>
          Depending on your location of residence, you may owe taxes on amounts
          you earn after staking digital assets. It is your responsibility to
          ensure you have accounted for, reported to the proper governmental
          authority, and paid all such taxes to the applicable governmental
          authority. We do not undertake any obligation to report any such
          taxes, nor collect or disburse them on your behalf. The taxes you owe
          are solely your responsibility. You hold us harmless and release us
          from and against any claims, losses, damages or demands arising in
          connection with taxes you may owe as a result of your use of the
          Services.
        </Paragraph>
        <Paragraph>
          If we believe that you have engaged in or been a participant in any
          fraudulent transaction, we reserve the right to take any action we
          think appropriate, including forwarding your information and
          information about the transactions we believe or suspect to be
          fraudulent to applicable law enforcement agencies, which may result in
          civil or criminal penalties or other actions against you.
        </Paragraph>
      </Section>
      <Section title="Confidentiality">
        <Paragraph>
          You and the Association recognize that each has a legitimate interest
          in maintaining confidentiality regarding these Terms, the subject
          matter of these Terms, or any other agreements, documents, or
          transactions referred to or contemplated herein and all trade secrets,
          confidential and/or proprietary knowledge or information of each other
          which you and/or the Association may receive or obtain as a result of
          entering into or performing its obligations under these Terms
          (collectively, “<strong>Confidential Information</strong>”).
        </Paragraph>
        <Paragraph>
          You and the Association undertake to the other that you and/or the
          Association shall keep the Confidential Information in the strictest
          confidence, and shall not, without the prior written consent of the
          other disclosing the Confidential Information, use or disclose to any
          person Confidential Information, information relating to these Terms,
          or the transactions contemplated hereunder it has or acquires or
          information which by its nature ought to be regarded as confidential
          (including without limitation, any business information in respect of
          the other which is not directly applicable or relevant to the
          transactions contemplated by these Terms).
        </Paragraph>
        <div>
          <Paragraph>
            The foregoing shall not prohibit disclosure or use of any
            Confidential Information if and to the extent:
          </Paragraph>
          <UnorderedList>
            <li>
              the disclosure or use is required by law or any government body;
            </li>
            <li>
              the disclosure or use is required for the purpose of any arbitral
              or judicial proceedings arising out of these Terms or any other
              agreement entered into under or pursuant to these Terms;
            </li>
            <li>
              the disclosure is made to your and/or our professional advisers on
              a need-to-know basis and on terms that such professional advisers
              undertake to comply with this section L. in respect of such
              information as if they were a party to these Terms;
            </li>
            <li>
              the information is or becomes publicly available (other than as a
              result of any breach of confidentiality);
            </li>
            <li>
              the disclosing party has given prior written approval to the
              disclosure or use; or
            </li>
            <li>
              the Confidential Information is already in the lawful possession
              of the party receiving such information (as evidenced by written
              records) at the time of disclosure.
            </li>
          </UnorderedList>
        </div>
      </Section>
      <Section title="User’s Representations and Indemnification">
        <div>
          <Paragraph>
            By using the Services, you represent and warrant that:
          </Paragraph>
          <UnorderedList>
            <li>
              you will not use the Services for any illegal or unauthorized
              purpose;{" "}
            </li>
            <li>
              your use of the Servies will not violate any applicable law or
              regulation;
            </li>
            <li>
              you are responsible for the payment of all relevant duties and/or
              charges and/or taxes arising from the course of your use of the
              Services;
            </li>
            <li>
              you will not act in any way that violates any applicable policies
              and terms posted on our Site, as may be revised from time to time,
              or included in any other agreement between you and us (including,
              without limitation in these Terms).
            </li>
          </UnorderedList>
        </div>
        <Paragraph>
          {`You agree to indemnify, defend, and hold harmless the Association, including our subsidiaries, affiliates, licensors, service providers, directors, officers, employees, agents, partners, contractors, successors, and assigns from and against any and all losses, damages, liabilities, claims, demands, actions, judgments, awards, costs, expenses, or fees (including reasonable attorneys' fees and expenses) arising out of or in connection with any third-party claims or any action, adjudication or decision taken against the Association by any government body, in each case, directly or indirectly arising (in whole or in part) out of any breach of these Terms.`}
        </Paragraph>
        <Paragraph>
          Notwithstanding the foregoing, we reserve the right, at your expense,
          to assume the exclusive defense and control of any matter for which
          you are obligated to indemnify us. You agree to cooperate fully in the
          defense of any such claim, action, or proceeding. This includes
          allowing us to control the investigation, defense, and settlement of
          any legal claim subject to your indemnification obligations. We will
          make reasonable efforts to notify you of any such claim, action, or
          proceeding as soon as we become aware of it.
        </Paragraph>
        <Paragraph>
          Your indemnification obligations under this section M. survive the
          termination of these Terms.
        </Paragraph>
      </Section>
      <Section title="Termination">
        <div>
          <Paragraph>
            We reserve the right to terminate or suspend you from accessing and
            using the Services immediately, without prior notice or liability,
            for any reason, including but not limited to the following:
          </Paragraph>
          <UnorderedList>
            <li>if you violate any of these Terms;</li>
            <li>
              if we are required to do so by law or a regulatory authority;
            </li>
            <li>if you engage in fraudulent or illegal activities; and/or</li>
            <li>
              if you act in a manner that could harm the reputation or
              operations of the Association.
            </li>
          </UnorderedList>
        </div>
        <Paragraph>
          Upon termination of your access to or use of the Services, you remain
          responsible for any obligations or liabilities incurred during your
          use of the Services.
        </Paragraph>
        <Paragraph>
          Termination of your access to or use of the Services does not limit
          any liability you may have incurred. All provisions of these Terms,
          which by their nature should survive termination, shall survive,
          including but not limited to intellectual property and trademarks
          (section J.), warranty disclaimers (section O.) indemnity (section
          M.), and limitations of liability (sections Q.) and sections R., S.,
          T., U., V., W, X.
        </Paragraph>
        <Paragraph>
          The Association shall not be liable to you or any third party for any
          termination of your access to or use of the Services. Any termination
          under this section N. shall be at the Association’s sole discretion.
        </Paragraph>
        <Paragraph>
          Without limiting the foregoing, we have the right to fully cooperate
          with any law enforcement authorities or court order requesting or
          directing us to disclose the identity or other information of anyone
          posting any materials on or through the Services. YOU WAIVE AND HOLD
          HARMLESS THE ASSOCIATION AND ITS AFFILIATES, LICENSEES AND SERVICE
          PROVIDERS FROM AND AGAINST ANY CLAIMS RESULTING FROM ANY ACTION TAKEN
          BY ANY OF THE FOREGOING PARTIES DURING, OR TAKEN AS A CONSEQUENCE OF,
          INVESTIGATIONS BY EITHER SUCH PARTIES OR LAW ENFORCEMENT AUTHORITIES.
        </Paragraph>
      </Section>
      <Section title="Linking to the Site and Social Media Features">
        <Paragraph>
          You may link to the Site, provided you do so in a way that is fair and
          legal and does not damage our reputation or take advantage of it, but
          you must not establish a link in such a way as to suggest any form of
          association, approval, or endorsement on our part without our express
          written consent.
        </Paragraph>
        <div>
          <Paragraph>
            The Site may provide certain features that enable you to:
          </Paragraph>
          <UnorderedList>
            <li>
              link from your own or certain third-party websites to certain
              content on the Site;
            </li>
            <li>
              send emails or other communications with certain content, or links
              to certain content, on the Site; or
            </li>
            <li>
              cause limited portions of content on the Site to be displayed or
              appear to be displayed on your own or certain third-party
              websites.
            </li>
          </UnorderedList>
        </div>
        <div>
          <Paragraph>
            You may use these features solely as they are provided by us, and
            solely with respect to the content they are displayed with and
            otherwise in accordance with any additional terms and conditions we
            provide with respect to such features. Subject to the foregoing, you
            must not:
          </Paragraph>
          <UnorderedList>
            <li>
              establish a link from any website that is not owned by you;{" "}
            </li>
            <li>
              cause the Site or portions of it to be displayed on, or appear to
              be displayed by, any other website, for example, framing, deep
              linking, or in-line linking;
            </li>
            <li>link to any part of the Site;</li>
            <li>
              otherwise take any action with respect to the materials on the
              Site that is inconsistent with any other provision of these Terms.
            </li>
          </UnorderedList>
        </div>
        <Paragraph>
          The website from which you are linking, or on which you make certain
          content accessible, must comply in all respects with these Terms.
        </Paragraph>
        <Paragraph>
          You agree to cooperate with us in causing any unauthorized framing or
          linking immediately to stop. We reserve the right to withdraw linking
          permission without notice.
        </Paragraph>
        <Paragraph>
          We may disable all or any social media features and any links at any
          time without notice in our discretion.
        </Paragraph>
      </Section>
      <Section title="Warranties Disclaimers and Risk Notices">
        <Paragraph>
          YOU EXPRESSLY ACKNOWLEDGE AND AGREE THAT YOUR ACCESS TO AND USE OF THE
          SERVICES, THEIR CONTENTS, AND ANY SERVICES OR ITEMS OBTAINED THROUGH
          THE SERVICES (INCLUDING THIRD PARTY CONTENT ON OR OFF CHAIN) IS AT
          YOUR OWN RISK.
        </Paragraph>
        <Paragraph>
          {`TO THE EXTENT NOT PROHIBITED BY LAW, WE PROVIDE SERVICES "AS IS", "WITH ALL FAULTS" AND "AS AVAILABLE", WITHOUT ANY WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. THIS INCLUDES, BUT IS NOT LIMITED TO, WARRANTIES OF MERCHANTABILITY, NON-INFRINGEMENT, AND FITNESS FOR A PARTICULAR PURPOSE. WE DO NOT GUARANTEE THAT THE ACCESS TO OR USE OF THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS, OR THAT ANY CONTENT WILL BE SECURE OR NOT OTHERWISE LOST OR DAMAGED.`}
        </Paragraph>
        <Paragraph>
          THE ASSOCIATION, ITS AFFILIATES, LICENSORS, AGENTS, SERVICE PROVIDERS,
          AND THEIR RESPECTIVE BOARD MEMBERS, DIRECTORS, REPRESRNTATIVES, AND
          EMPLOYEES CANNOT AND DO NOT GUARANTEE OR WARRANT THAT ACCESS TO OR USE
          OF THE SERVICES WILL BE UNINTERRUPTED, SECURE OR AVAILABLE AT ANY
          PARTICULAR TIME OR LOCATION; OR THE RESULTS OF USE OF THE SERVICES
          WILL MEET YOUR REQUIREMENTS.
        </Paragraph>
        <Paragraph>
          THE SERVICES MAY NOT BE AVAILABLE DUE TO ANY NUMBER OF FACTORS
          INCLUDING, BUT NOT LIMITED TO, PERIODIC SYSTEM MAINTENANCE, SCHEDULED
          OR UNSCHEDULED, ACTS OF GOD, UNAUTHORIZED ACCESS, VIRUSES, DENIAL OF
          SERVICE OR OTHER ATTACKS, TECHNICAL FAILURE OF THE SERVICES AND/OR
          TELECOMMUNICATIONS INFRASTRUCTURE OR DISRUPTION, AND THEREFORE WE
          EXPRESSLY DISCLAIM ANY EXPRESS OR IMPLIED WARRANTY REGARDING THE USE
          AND/OR AVAILABILITY, ACCESSIBILITY, SECURITY OR PERFORMANCE OF THE
          SERVICES CAUSED BY SUCH FACTORS. NEITHER THE ASSOCIATION, NOR ITS
          AFFILIATES, LICENSORS, AGENTS, SERVICE PROVIDERS, AND THEIR RESPECTIVE
          BOARD MEMBERS, DIRECTORS, REPRESENTATIVES, AND EMPLOYEES, NOR ANY
          OTHER PERSON ASSOCIATED WITH THE ASSOCIATION MAKE ANY REPRESENTATIONS
          OR WARRANTIES AGAINST THE POSSIBILITY OF DELETION, MISDELIVERY OR
          FAILURE TO STORE COMMUNICATIONS, PERSONALIZED SETTINGS OR OTHER DATA.
        </Paragraph>
        <Paragraph>
          YOU ACCEPT THE INHERENT SECURITY RISKS OF PROVIDING INFORMATION AND
          DEALING ONLINE OVER THE INTERNET AND WILL NOT HOLD US RESPONSIBLE FOR
          ANY BREACH OF SECURITY. NEITHER THE ASSOCIATION, NOR ITS AFFILIATES,
          LICENSORS, AGENTS, SERVICE PROVIDERS, AND THEIR RESPECTIVE BOARD
          MEMBERS, DIRECTORS, REPRESENTATIVES, AND EMPLOYEES, NOR ANY OTHER
          PERSON ASSOCIATED WITH THE ASSOCIATION WILL BE RESPONSIBLE OR LIABLE
          FOR ANY LOSS, AND NO SUCH PARTY TAKES ANY RESPONSIBILITY FOR, AND WILL
          NOT BE LIABLE FOR, ANY USE OF THE SERVICES, INCLUDING BUT NOT LIMITED
          TO ANY LOSSES, DAMAGES OR CLAIMS ARISING FROM: (I) SERVER FAILURE OR
          DATA LOSS; (II) BLOCKCHAIN NETWORKS, DIGITAL WALLETS OR CORRUPT FILES;
          (III) UNAUTHORIZED ACCESS TO THE SERVICES; OR (IV) ANY THIRD-PARTY
          ACTIVITIES, INCLUDING WITHOUT LIMITATION THE USE OF VIRUSES, PHISHING,
          BRUTEFORCING OR OTHER MEANS OF ATTACK.
        </Paragraph>
        <Paragraph>
          By accessing or using the Services, you represent that you understand
          the inherent risks associated with cryptographic systems and
          blockchain-based networks; and warrant that you have an understanding
          of the usage and intricacies of digital assets, smart contract-based
          cryptographic tokens, decentralized networks, and systems that
          interact with blockchain-based networks.
        </Paragraph>
        <Paragraph>
          You acknowledge and agree that digital assets are volatile and risky,
          and their staking is affected by many factors outside our or your
          control. You are solely responsible for any transactions, and for all
          fees that you may incur as a result of you staking digital assets,
          including (without limitation) “gas” costs. The Services do not
          control the timing of any transaction, yet you acknowledge that the
          time of a transaction can affect the value of the digital asset or the
          fees associated with a transaction or both. You hereby agree that you
          hold us harmless against any and all claims arising from the
          transaction of your digital assets, or the timing of such
          transactions. Digital assets are not legal tender and are not backed
          by any government. Digital assets are not subject to Federal Deposit
          Insurance Corporation or Securities Investor Protection Corporation
          protections. We make no guarantee as to the functionality of any
          digital asset network which might cause delays, conflicts of interest
          or might be subject to operational decisions of third parties that are
          unfavorable to you or affect your digital assets, or lead to your
          inability to complete a transaction. You hold us harmless from and
          against any losses you suffer as a result of your use of such
          third-party services, networks and protocols, even if you access them
          from our Services. There are no guarantees that a transfer initiated
          via your digital wallet on the Services will successfully transfer
          title of or right in any digital assets. You acknowledge that, while
          the Services and the underlying software have been tested, it is still
          relatively new and could have bugs or security vulnerabilities. You
          further acknowledge that the Services and the underlying software are
          still under development and may undergo significant changes over time
          that may not meet Users’ expectations. You acknowledge that your use
          of certain technologies (e.g., jailbreaking tech) on the device with
          which you access the Services, may cause the Services not to work. You
          acknowledge that you accept all risk associated with your use of such
          advanced technologies, and any errors they may cause. You hereby hold
          us harmless from any losses you suffer as a result of your use of such
          technologies.
        </Paragraph>
        <Paragraph>
          Digital assets and use of our Services may be subject to expropriation
          and/or theft. Hackers or other malicious actors may attempt to
          interfere with our Services or your use thereof in a variety of ways,
          including, but not limited to, use of malware, denial of service
          attacks, Sybil attacks, and spoofing. Furthermore, because much of our
          Services rely on open-source software, there is the software
          underlying our code that may contain intentional or unintentional bugs
          or weaknesses which may negatively affect the Services, or result in
          the loss of your digital assets, or your ability to control your
          digital wallet. You hold us harmless from and against any losses you
          suffer as a result of such issues. You agree that your use of the
          Services is subject to, and you will comply with any, applicable
          open-source licenses governing any such open-source components. The
          information on our Services may not always be entirely accurate,
          complete or current. Information on the Services may be changed or
          updated from time to time without notice, including information
          regarding our policies, products and services. Accordingly, you should
          verify all information before relying on it. All decisions you make
          based on information provided through the Services are your sole
          responsibility and you hold us harmless from and against any losses
          you suffer as a result of such decisions. The Services may contain
          materials offered by or created by third parties. All such materials,
          and links to third party websites are provided as a convenience only.
          We do not control such materials, and provide no guarantee as to their
          accuracy, completeness, legality or usefulness. You acknowledge and
          agree that we are not responsible for any aspect of the information,
          content, or services contained in any such third-party materials
          accessible or linked to from the Services. You agree and understand
          that all staking decisions and transactions are made solely by you.
          You agree and understand that under no circumstances will the
          operation of the Services and your use of it be deemed to create a
          relationship that includes the provision of or tendering of investment
          advice. NO FINANCIAL, INVESTMENT, TAX, LEGAL OR SECURITIES ADVICE IS
          GIVEN THROUGH OR IN CONNECTION WITH OUR SERVICES. No content found on
          the Services, whether created by us or another User is or should be
          considered as investment advice. You agree and understand that we
          accept no responsibility whatsoever for, and shall in no circumstances
          be liable in connection with, your decisions to use the Services.
          Nothing contained on the Services constitutes a solicitation,
          recommendation, endorsement, or offer by us or any third party to
          stake, buy or sell any digital assets, securities, or other financial
          instruments. Neither us nor any of our affiliates has: (1) evaluated
          the merit of any non-custody staking mechanisms available through the
          Services; or (2) has endorsed or sponsored any digital assets made
          available.
        </Paragraph>
        <Paragraph>
          IF YOU ARE DISSATISFIED WITH THE USE OF THE SERVICES, OR WITH THESE
          TERMS, YOUR SOLE AND EXCLUSIVE REMEDY IS TO DISCONTINUE USING THE
          SERVICES.
        </Paragraph>
        <Paragraph>
          SOME JURISDICTIONS DO NOT ALLOW EXCLUSION OF WARRANTIES OR LIMITATIONS
          ON THE DURATION OF IMPLIED WARRANTIES, SO THE ABOVE DISCLAIMER MAY NOT
          APPLY TO YOU IN ITS ENTIRETY BUT WILL APPLY TO THE MAXIMUM EXTENT
          PERMITTED BY APPLICABLE LAW.
        </Paragraph>
      </Section>
      <Section title="Liability Disclaimer">
        <Paragraph>
          THE ASSOCIATION, ITS AFFILIATES, LICENSORS, AGENTS, SERVICE PROVIDERS,
          AND THEIR RESPECTIVE BOARD MEMBERS, DIRECTORS, REPRESENTATIVES, AND
          EMPLOYEES WILL NOT BE LIABLE FOR DAMAGES OF ANY KIND, UNDER ANY LEGAL
          THEORY, ARISING OUT OF OR IN CONNECTION WITH YOUR ACCESS TO OR USE OF,
          OR INABILITY TO ACCESS OR USE, THE SERVICES. THIS INCLUDES BUT IS NOT
          LIMITED TO, PERSONAL INJURY, PAIN AND SUFFERING, EMOTIONAL DISTRESS,
          LOSS OF REVENUE, PROFITS, BUSINESS OR ANTICIPATED SAVINGS, LOSS OF
          USE, GOODWILL, OR DATA, CAUSED BY TORT (INCLUDING NEGLIGENCE), BREACH
          OF CONTRACT, OR OTHERWISE, EVEN IF FORESEEABLE.
        </Paragraph>
        <Paragraph>
          THE LIMITATION OR EXCLUSION OF LIABILITY FOR INCIDENTAL,
          CONSEQUENTIAL, OR OTHER DAMAGES WILL NOT APPLY TO YOU TO THE EXTENT
          PROHIBITED BY APPLICABLE LAW. IN JURISDICTIONS WHERE SUCH EXCLUSIONS
          AND LIMITATIONS ARE NOT ALLOWED, WE ARE RESPONSIBLE TO YOU ONLY FOR
          LOSSES AND DAMAGES THAT ARE A REASONABLY FORESEEABLE RESULT OF OUR
          FAILURE TO USE REASONABLE SKILL AND CARE OR OUR BREACH OF THESE TERMS.
        </Paragraph>
        <Paragraph>
          THE AGGREGATE LIABILITY OF THE ASSOCIATION AND ITS AFFILIATES,
          LICENSORS, AGENTS AND SERVICE PROVIDERS RELATING TO THE SERVIES WILL
          BE LIMITED TO ONE HUNDRET FRANCS (CHF 100.00). THE LIMITATIONS AND
          EXCLUSIONS APPLY EVEN IF THIS REMEDY DOES NOT FULLY COMPENSATE YOU FOR
          ANY LOSSES OR FAILS OF ITS ESSENTIAL PURPOSE.
        </Paragraph>
        <Paragraph>
          IF ANY PROVISION OF THIS SECTION Q. IS OR BECOMES INVALID, THE
          REMAINING PROVISIONS SHALL REMAIN UNAFFECTED AND WILL BE REPLACED BY A
          VALID PROVISION THAT CLOSELY MATCHES THE ECONOMIC INTENT OF THE
          INVALID PROVISION.
        </Paragraph>
      </Section>
      <Section title="Force Majeure">
        <Paragraph>
          The Association is not liable for any damage, loss, delay, or
          inconvenience caused by circumstances beyond our reasonable control.
          Such circumstances include, but are not limited to, war, threats of
          war, riots, civil disturbances, terrorist activities, industrial
          disputes, natural or nuclear disasters, fires, airport closures,
          adverse weather conditions, utility service interruptions or failures,
          or actions by any local or national government.
        </Paragraph>
      </Section>
      <Section title="Nature of these Terms">
        <Paragraph>
          Nothing contained in these Terms shall be construed as creating any
          agency, partnership, employment of any type or other form of joint
          enterprise between you and the Association. You shall not represent to
          the contrary, either expressly, implicitly, by appearance, or
          otherwise.
        </Paragraph>
      </Section>
      <Section title="Severability">
        <Paragraph>
          If any provision of these Terms is deemed invalid by a court of
          competent jurisdiction, that provision will be limited to the minimum
          extent necessary, and the remaining provisions will continue to be
          fully effective.
        </Paragraph>
      </Section>
      <Section title="No Waiver">
        <Paragraph>
          Our failure to enforce any provision of these Terms does not
          constitute a waiver of its right to enforce that provision, any other
          provision, or these Terms as a whole in the future.
        </Paragraph>
      </Section>
      <Section title="Assignment">
        <Paragraph>
          You may not assign any of your rights, licenses, or obligations under
          these Terms without our prior written consent. Any attempt by you to
          do so will be void. We may assign its rights, licenses, and
          obligations under these Terms without any limitations and without your
          prior consent.
        </Paragraph>
      </Section>
      <Section title="Notices">
        <Paragraph>
          Any notices or other communications provided by the Association under
          these Terms will be given: (i) via email; or (ii) by posting to the
          Services. For notices made by email, the date of receipt will be
          deemed the date on which such notice is transmitted.
        </Paragraph>
      </Section>
      <Section title="Applicable Law and Place of Jurisdiction">
        <Paragraph>
          All matters relating to the access to and use of the Services and
          these Terms, including any dispute or claim arising from or related to
          them (including non-contractual disputes or claims), shall be governed
          by and construed in accordance with the internal laws of Switzerland,
          without regard to any choice or conflict of law provision or rule
          (whether of Switzerland or any other jurisdiction).
        </Paragraph>
        <Paragraph>
          Any disputes, legal suit, action, or proceeding arising out of or
          related to these Terms shall be subject to the exclusive jurisdiction
          of the Courts of Zug, ZG, Switzerland, subject to an appeal at the
          Swiss Federal Court. However, we retain the right to bring any suit,
          action, or proceeding against you for breach of this Policy in your
          country of residence or any other relevant country. You waive any
          objections to the exercise of jurisdiction over you by such courts and
          to venue in such courts.
        </Paragraph>
        <Paragraph>
          You agree that any dispute with us shall be resolved solely on an
          individual basis and not as a class action or any other representative
          proceeding. You agree that you cannot bring a claim as a class or
          representative action, nor on behalf of any other person or persons.
        </Paragraph>
        <Paragraph>
          In the event of a dispute, you agree to maintain the confidentiality
          of all proceedings, including, but not limited to, any and all
          information gathered, prepared, and presented for the purposes of
          litigation or related to the dispute(s).
        </Paragraph>
      </Section>
    </dl>
  </main>
);

type SectionProps = HTMLProps<HTMLElement> & {
  title: ReactNode;
  children: ReactNode | ReactNode[];
};

const Section = ({ title, children, className, ...props }: SectionProps) => (
  <section
    className={clsx(
      "list-item flex-col gap-4 marker:text-xl marker:font-bold",
      className,
    )}
    {...props}
  >
    <dd className="ml-2 inline text-xl font-bold">{title}</dd>
    <dt className="flex flex-col gap-4">{children}</dt>
  </section>
);

const Paragraph = ({
  className,
  ...props
}: HTMLProps<HTMLParagraphElement>) => (
  <p className={clsx("", className)} {...props} />
);

const UnorderedList = ({
  className,
  ...props
}: HTMLProps<HTMLUListElement>) => (
  <ul className={clsx("mx-4 list-inside list-disc", className)} {...props} />
);

const Link = ({ className, ...props }: ComponentProps<typeof BaseLink>) => (
  <BaseLink className={clsx("underline", className)} {...props} />
);
