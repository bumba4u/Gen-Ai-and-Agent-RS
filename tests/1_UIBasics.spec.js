const {test,expect} =require('@playwright/test');

test('Browser cntext',async({browser})=>{

  
   const context = await browser.newContext();
   const page =await context.newPage();

    const userName= page.locator("#username");
    const password= page.locator("#password");
    const signInBtn= page.locator("#signInBtn");
    const cartText=page.locator(".card-title a");

    // Navigate to the application URL
    await page.goto('https://rahulshettyacademy.com/loginpagePractise/');  
   await page.locator("#username").fill("rahulshettyacademy"); 
   await page.locator("#password").fill("learning1");
   await page.locator("#signInBtn").click();
   console.log(await page.locator("div[style*='block']").textContent());
    await expect(page.locator("div[style*='block']")).toContainText("Incorrect");

    await page.screenshot({path:"screenshot.png"});
    await userName.fill("rahulshettyacademy");
    await password.fill("Learning@830$3mK2");
     await signInBtn.click();
    await expect(page).toHaveURL("https://rahulshettyacademy.com/angularpractice/shop");

       
      console.log(await page.locator(".card-title a").nth(1).textContent());
      console.log(await page.locator(".card-title a").first().textContent());
      console.log(await page.locator(".card-title a").last().textContent());
      await expect(cartText.last()).toContainText('Blackberry');

      await page.screenshot({path:"screenshot1.png"});
    
    const titleCount= await cartText.count();
    console.log(titleCount);
  //Below way to get all the text contents will only work if we print single element earlier
     const alltitles= await cartText.allTextContents();
     console.log(alltitles);

     for (let i = 0; i < titleCount; ++i) {
  console.log(`item ${i}:`, await cartText.nth(i).textContent());
}
     


});

test('Page fixture', async ({page}) =>

{
    // Navigate to the example page

    await page.goto("https://rahulshettyacademy.com/AutomationPractice/");
    await page.goto("https://google.com");
    console.log(await page.title());
    await expect(page).toHaveTitle(/Google/);
    expect(await page.title()).toBe("Google");
    await page.goBack();
    //await page.goForward();

        
});

