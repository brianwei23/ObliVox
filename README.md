# ObliVox
An end-to-end encrypted voice recorder application, and it contains many security features. This was created as a personal cybersecurity project.

## How to use and Features
  * Go to https://oblivox.com/register to create an account. Then log in. Please create a strong password that is hard to brute force. The encryption keys are not stored anywhere. Instead they are derived from your password (which are hashed with SHA-256 in the database).

  * If the link is no longer available at the time you see this, then please see this video: https://youtu.be/yQuCvLLKzSw

  * To record, click on the record button at the bottom of the **My Recordings** page. Then name the recording and select the option for it to self-destruct in the future or keep forever. The audio recordings and name are encrypted with **AES-256** using the key derived from your account password before being stored in the database. 

  * To share a recording, click on the **Share** button located on the recording, and type in the ObliVox user you would like to share it to. Create a password only for the recipient. The shared content is end-to-end encrypted using a key that is derived from this password. This feature ensures that if a hacker gets into the recipient's account, they would still not be able to access the recording you shared.

  * Recipients can view the shared recording by clicking on **View Shares** button in the main **My Recordings** page. The recipient will then have to enter the password to decrypt the recording and the recording's name.

  * To verify the integrity of the recording you created or a recording that was shared to you, click on the "Verify integrity" button that is located in each recording. **Stored hash** is the hash computed right after the recording is made and before the recording is encrypted. This hash is then stored in the database. **Current computed hash** is the hash that is computed using the recording that you currently have. If there is a difference between the stored and current hash, then there could be an unauthorized change or a data corruption issue. Hashes use the **SHA-256** algorithm.

  * You can create a folder for recordings by clicking on the **Folders** button in the main **My Recordings** page. Then click on **+ Add Folder**. Then name it. Then you have the option to assign a password to a folder. You also have the option to create a decoy folder, and it is recommended that you use a different password for decoy and original folders. 

  * Folder names and recordings (and names) in folders without additional password are encrypted in the client with the key derived from the account password. Recordings (and its names) in folders (including decoy) that are password protected are encrypted using the key derived from the folder password.  

  * To view login logs, click on the **Login Log** button in the main **My Recordings** page, to view current and past login sessions for the account.

  * The site is designed for its simplicity so that it is easy for new users to navigate through.

  * **Cybersecurity**: Aside from encryption and hashing details already mentioned, Next.js and Django is used here to mitigate most XSS, SQL injection, and buffer overflow vulnerabilities. Measures are also in place to prevent URL traversal and the ability to use the back button after logout. The site uses **HTTPS** to ensure that your web interaction is encrypted. A two minute lockout after five unsuccessful login tries is in place to prevent brute force attacks.

## Tools
 * **Django** is used on the backend and connects to the database. **APScheduler** was used locally to self-destruct recordings according to the user's options. Later, it was switched to cron. **Gunicorn** is used to help run Django in production. The programming language is **Python**.

 * **Next.js**: used for the frontend. The language used here is **Typescript**. 

 * **Postgres**: a **relational database** that stores all user information such as encrypted recordings, hashed passwords, usernames, etc. The **SQL language** is used to query entities in pgAdmin.

* **Tailwind CSS**: determines the style and size of the UI components

* **AWS**: 
  * The database is hosted using **RDS** (Postgres)
  * For the backend, **Elastic Beanstalk** manages Django on **EC2** instances
  * **Application load balancer** for HTTPS routing
  * **cron** in EC2 for self-destruct functionality 
  * **Amplify**: hosts Next.js frontend
  * **ACM** to manage certificates for the site.

* **Cloudflare Registrar**: oblivox.com is obtained and CNAME configuration is done here.
